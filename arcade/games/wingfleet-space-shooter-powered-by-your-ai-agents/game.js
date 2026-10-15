// Wingfleet — a 3D neon arcade space shooter for RIFFCADE. Original game; all art is drawn in code.
// The player flies and shoots. Their live AI coding agents (Claude Code / Codex sessions) fly as wingmen, and
// what those agents get done is the arsenal: tool results fire missiles / lasers / beams, passing tests drop a
// smart bomb, commits recharge shields, deploys fire a mega laser, tokens charge the player's super meter.
import { THREE, createStage, rounded, burst, tone, note, store, loop, lerp, clamp } from './kit/hc.js';
import { agents, toolName, toast } from './kit/agents.js';
import { board, flag } from './kit/board.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.floor(n).toLocaleString('en-US');
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ save
const S = store('wingfleet');
const sget = (k, d) => { try { return S.get(k, d); } catch (e) { return d; } };
const sset = (k, v) => { try { S.set(k, v); } catch (e) {} };
const dayKey = () => new Date().toLocaleDateString('en-CA');
const P = {};
for (const [k, d] of Object.entries({ best: 0, bestWave: 0, kills: 0, xp: 0, runs: 0, ship: 'arrow', scheme: 0, streak: 0, lastDay: '', mute: false, bestCombo: 0 })) P[k] = sget(k, d);
let D = sget('day_' + dayKey(), null) || { score: 0, wave: 0, runs: 0, kills: 0 };
const saveP = () => { for (const k of Object.keys(P)) sset(k, P[k]); sset('day_' + dayKey(), D); };

const SHIPS = [
  { id: 'arrow', name: 'Arrow', need: 'Starter', ok: () => true, rate: 7, guns: [[-0.55, 0, 0], [0.55, 0, 0]], dmg: 1 },
  { id: 'manta', name: 'Manta', need: 'Wave 5', ok: () => P.bestWave >= 5, rate: 5.5, guns: [[-0.85, 0.1, 0], [0.85, 0.1, 0]], dmg: 1 },
  { id: 'twin', name: 'Twinblade', need: 'Wave 10 or 300 XP', ok: () => P.bestWave >= 10 || P.xp >= 300, rate: 7, guns: [[-0.65, 0, -0.1], [0, -0.7, 0], [0.65, 0, 0.1]], dmg: 1 },
  { id: 'halo', name: 'Halo', need: 'Wave 15 or 1k XP', ok: () => P.bestWave >= 15 || P.xp >= 1000, rate: 6, guns: [[-0.6, 0, -0.05], [0.6, 0, 0.05]], dmg: 1.4, seeker: true },
];
const SCHEMES = [
  { name: 'Ion', hull: '#dfe9ff', trim: '#4ef2ff', need: 0 },
  { name: 'Ember', hull: '#3a2630', trim: '#ff8a3d', need: 150 },
  { name: 'Venom', hull: '#22352a', trim: '#7cff6b', need: 400 },
  { name: 'Synth', hull: '#2e2350', trim: '#ff4fd8', need: 800 },
  { name: 'Solar', hull: '#fff1cf', trim: '#ffd23f', need: 1500 },
  { name: 'Void', hull: '#14131f', trim: '#a78bff', need: 3000 },
];
const shipDef = () => SHIPS.find(s => s.id === P.ship && s.ok()) || SHIPS[0];
const scheme = () => SCHEMES[P.scheme] && P.kills >= SCHEMES[P.scheme].need ? SCHEMES[P.scheme] : SCHEMES[0];

// ------------------------------------------------------------------ sound (only after a gesture, quiet)
let audioOK = false; const sndT = {};
addEventListener('pointerdown', () => audioOK = true); addEventListener('keydown', () => audioOK = true);
function snd(name, gap, fn) { if (!audioOK || P.mute) return; const n = performance.now(); if (sndT[name] && n - sndT[name] < gap) return; sndT[name] = n; fn(); }
const SFX = {
  boom: (s = 1) => snd('boom', 70, () => { tone(120, 0.22 * s, 'sawtooth', 0.05, 0.35); tone(60, 0.3 * s, 'square', 0.035, 0.5); }),
  missile: () => snd('mis', 90, () => tone(620, 0.09, 'triangle', 0.035, 1.8)),
  laser: () => snd('las', 80, () => tone(1500, 0.14, 'sawtooth', 0.025, 0.25)),
  hurt: () => snd('hurt', 120, () => { tone(200, 0.18, 'square', 0.06, 0.5); }),
  fail: () => snd('fail', 150, () => tone(160, 0.14, 'square', 0.035, 0.7)),
  bomb: () => snd('bomb', 300, () => { tone(70, 0.7, 'sawtooth', 0.09, 0.3); [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.06, 1), 120 + i * 80)); }),
  shield: () => snd('sh', 300, () => [660, 880, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'sine', 0.06, 1.1), i * 70))),
  ping: () => snd('ping', 400, () => { note(84, 0.3, 0.08); setTimeout(() => note(88, 0.4, 0.08), 140); }),
  wave: () => snd('wave', 400, () => [392, 523, 659].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.06, 1), i * 90))),
  super: () => snd('sup', 400, () => { tone(220, 0.8, 'sawtooth', 0.06, 4); tone(330, 0.8, 'square', 0.03, 3); }),
  scan: () => snd('scan', 150, () => tone(900, 0.25, 'sine', 0.035, 0.5)),
  zap: () => snd('zap', 2000, () => tone(90, 1.2, 'sawtooth', 0.04, 1.4)),
};

// ------------------------------------------------------------------ stage + space
const st = createStage({ fov: 50, shadows: false, clear: '#05030f' });
const { scene, camera, renderer, hemi, sun } = st;
hemi.color.set('#a8c8ff'); hemi.groundColor.set('#40125a'); hemi.intensity = 1.0;
sun.intensity = 2.4; sun.position.set(-6, 22, 10);
const rim = new THREE.DirectionalLight('#ff4fd8', 1.4); rim.position.set(10, 5, -16); scene.add(rim);

function canvasTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const GLOW = canvasTex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, '#fff'); r.addColorStop(0.16, 'rgba(255,255,255,.9)'); r.addColorStop(0.42, 'rgba(255,255,255,.28)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
const RETICLE = canvasTex(128, g => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 44, 0.3, 1.27); g.stroke(); g.beginPath(); g.arc(64, 64, 44, 1.87, 2.84); g.stroke(); g.beginPath(); g.arc(64, 64, 44, 3.44, 4.41); g.stroke(); g.beginPath(); g.arc(64, 64, 44, 5.01, 5.98); g.stroke(); g.lineWidth = 5; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30); g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 5, 0, TAU); g.fill(); });
const BUBBLE = canvasTex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.62, 'rgba(255,255,255,.07)'); r.addColorStop(0.88, 'rgba(255,255,255,.55)'); r.addColorStop(0.95, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });

const pool = [];
function spr(color, sx, sy = sx, op = 1, map = GLOW) {
  let s = pool.pop();
  if (!s) s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.material.map = map; s.material.color.set(color); s.material.opacity = op; s.material.rotation = 0; s.scale.set(sx, sy, 1); s.renderOrder = 2; scene.add(s); return s;
}
const unspr = s => { scene.remove(s); pool.push(s); };
const ownSprite = (color, size, map = GLOW, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })); s.scale.set(size, size, 1); s.renderOrder = 2; return s; };

// parallax star layers
const stars = [];
for (const [n, y, size, speed, col] of [[800, -8, 0.32, 0.16, '#d6e6ff'], [600, -28, 0.7, 0.07, '#a9b4ff'], [320, -70, 1.6, 0.025, '#ffc8f0']]) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 160; pos[i * 3 + 1] = y + (Math.random() - 0.5) * 6; pos[i * 3 + 2] = -170 + Math.random() * 210; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size, map: GLOW, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(m); stars.push({ m, pos, speed, n });
}
const nebula = [];
for (const [x, z, s, c, o] of [[-34, -70, 110, '#5b2bff', 0.3], [38, -30, 90, '#ff2fa8', 0.2], [0, -130, 150, '#1f8bff', 0.2], [-40, 10, 80, '#8a2be2', 0.18], [30, -100, 80, '#00e0c6', 0.12]]) {
  const sp = ownSprite(c, s, GLOW, o); sp.position.set(x, -100, z); sp.renderOrder = 0; scene.add(sp); nebula.push(sp);
}
const planet = new THREE.Group();
planet.add(new THREE.Mesh(new THREE.SphereGeometry(16, 48, 32), new THREE.MeshStandardMaterial({ color: '#3a2470', emissive: '#170733', roughness: 0.85 })));
const pRing = new THREE.Mesh(new THREE.RingGeometry(21, 30, 96), new THREE.MeshBasicMaterial({ color: '#ff7ad9', transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
pRing.rotation.x = -Math.PI / 2 + 0.4; pRing.rotation.y = 0.3; planet.add(pRing);
const atmo = ownSprite('#8a5bff', 44, GLOW, 0.35); planet.add(atmo);
planet.position.set(-70, -110, -120); planet.scale.setScalar(0.65); scene.add(planet);

// ------------------------------------------------------------------ field + camera
const F = { W: 8, zBot: 10, zTop: -30 };
const camBase = new THREE.Vector3(), camLook = new THREE.Vector3();
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const groundAt = (nx, ny) => { ray.setFromCamera(new THREE.Vector2(nx, ny), camera); return ray.ray.intersectPlane(ground, new THREE.Vector3()) || new THREE.Vector3(0, 0, -40); };
let portrait = false;
function layout() {
  portrait = innerWidth / innerHeight < 0.8;
  if (portrait) { camBase.set(0, 36, 9); camLook.set(0, 0, -7); } else { camBase.set(0, 29, 10); camLook.set(0, 0, -5); }
  camera.position.copy(camBase); camera.lookAt(camLook); camera.updateMatrixWorld();
  F.zBot = groundAt(0, -1).z; F.zTop = Math.max(groundAt(0, 0.92).z, -46);
  F.W = Math.min(Math.abs(groundAt(1, -0.35).x) - 0.8, 12);
}
addEventListener('resize', layout); layout();

// ------------------------------------------------------------------ fx: particles, rings, beams, explosions, shake
const fx = [], rings = [], beams = [];
function part(x, y, z, color, size, { vx = 0, vy = 0, vz = 0, life = 0.5, grow = 1, drag = 0.94 } = {}) {
  if (fx.length > 1100) return;
  const s = spr(color, size); s.position.set(x, y, z); fx.push({ s, vx, vy, vz, life, max: life, size, grow, drag });
}
function sparks(x, z, color, n, speed = 0.35, size = 0.4, life = 0.5) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = speed * (0.3 + Math.random()); part(x, 0.3, z, color, size * (0.6 + Math.random() * 0.8), { vx: Math.cos(a) * v, vy: (Math.random() - 0.2) * v * 0.6, vz: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.8), grow: 0.25, drag: 0.92 }); }
}
const RING_G = new THREE.RingGeometry(0.86, 1, 72), RING_T = new THREE.RingGeometry(0.965, 1, 96);
function ring(x, z, color, r1, life = 0.5, r0 = 0.3, op = 1) {
  const m = new THREE.Mesh(r1 > 7 ? RING_T : RING_G, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.15, z); scene.add(m); rings.push({ m, life, max: life, r0, r1, op });
}
const BEAM_G = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), UP = new THREE.Vector3(0, 1, 0);
function makeBeam(color) {
  const g = new THREE.Group(), mo = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), mc = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const o = new THREE.Mesh(BEAM_G, mo), c = new THREE.Mesh(BEAM_G, mc); c.scale.set(0.38, 1, 0.38); g.add(o, c); g.mats = [mo, mc]; return g;
}
function placeBeam(g, x1, z1, x2, z2, w) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.max(0.01, Math.hypot(dx, dz));
  g.position.set((x1 + x2) / 2, 0.35, (z1 + z2) / 2); g.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx / len, 0, dz / len)); g.scale.set(w, len, w);
}
function beam(x1, z1, x2, z2, color, w, life) {
  const g = makeBeam(color); placeBeam(g, x1, z1, x2, z2, w); scene.add(g); beams.push({ g, life, max: life, w });
  part(x1, 0.4, z1, color, w * 7, { life: life * 0.8, grow: 0.5 }); part(x2, 0.4, z2, '#ffffff', w * 6, { life: life * 0.8, grow: 0.5 });
}
let shk = 0, hitStop = 0, punch = 0;
const shake = a => { shk = Math.min(1.8, shk + a); };
function flash(color = '#fff', a = 0.5) { const f = $('#flash'); f.style.transition = 'none'; f.style.background = color; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); }
function boom(x, z, color, size = 1) {
  part(x, 0.6, z, '#ffffff', size * 2.6, { life: 0.18, grow: 0.25 });
  part(x, 0.5, z, color, size * 5.5, { life: 0.5, grow: 0.3 });
  sparks(x, z, color, Math.round(10 + size * 10), 0.28 * size + 0.15, 0.45, 0.6);
  sparks(x, z, '#fff6c8', 6, 0.45 * size + 0.1, 0.28, 0.35);
  ring(x, z, color, size * 3.4, 0.45);
  burst(scene, new THREE.Vector3(x, 0.4, z), [color, '#2a2140', '#ffffff'], Math.round(4 + size * 5), { speed: 0.12 * size + 0.06, up: 0.03, size: 0.9 * Math.min(size, 2), gravity: 0.002, life: 1 });
  shake(0.12 * size); SFX.boom(Math.min(size, 2));
}
function updFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i]; p.life -= dt / 60;
    if (p.life <= 0) { unspr(p.s); fx.splice(i, 1); continue; }
    const k = Math.pow(p.drag, dt); p.vx *= k; p.vy *= k; p.vz *= k;
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    const f = p.life / p.max, sc = p.size * lerp(p.grow, 1, f); p.s.material.opacity = f; p.s.scale.set(sc, sc, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.life -= dt / 60;
    if (r.life <= 0) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); continue; }
    const f = 1 - r.life / r.max, e = 1 - Math.pow(1 - f, 3), rad = lerp(r.r0, r.r1, e); r.m.scale.set(rad, rad, rad); r.m.material.opacity = r.op * (1 - f);
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.life -= dt / 60;
    if (b.life <= 0) { scene.remove(b.g); b.g.mats.forEach(m => m.dispose()); beams.splice(i, 1); continue; }
    const f = b.life / b.max, w = b.w * Math.sqrt(f) * (1 + Math.sin(performance.now() / 25) * 0.15); b.g.scale.x = b.g.scale.z = w; b.g.mats[0].opacity = 0.5 * f; b.g.mats[1].opacity = f;
  }
}
const v3 = new THREE.Vector3();
function toScreen(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight, v3.z < 1]; }
let pops = 0;
function popAt(x, z, text, color = '#fff', size = 16) {
  if (pops > 14) return; const [sx, sy] = toScreen(x, 0.5, z);
  const d = document.createElement('div'); d.className = 'pop'; d.textContent = text; d.style.cssText = `left:${sx}px;top:${sy}px;color:${color};font-size:${size}px`;
  $('#tags').appendChild(d); pops++; setTimeout(() => { d.remove(); pops--; }, 900);
}
function banner(text, sub = '', color = '#4ef2ff') { const b = $('#banner'); b.innerHTML = `<b style="color:${color}">${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }

// ------------------------------------------------------------------ models
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45, ...o });
const emi = (color, i = 1.3) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4, metalness: 0.2 });
function wingGeo(span, back, front, thick = 0.1, notch = 0) {
  const s = new THREE.Shape(); s.moveTo(0, front); s.lineTo(span, -back); s.lineTo(span * 0.55, -back + notch); s.lineTo(0, -back * 0.55); s.lineTo(-span * 0.55, -back + notch); s.lineTo(-span, -back); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); g.rotateX(-Math.PI / 2); return g;
}
function buildShip(id, sch) {
  const g = new THREE.Group(), hull = std(sch.hull), trim = emi(sch.trim, 1.5), glass = std('#0b1030', { emissive: sch.trim, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.1 }), dark = std('#1a1830');
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  let eng = [];
  if (id === 'arrow') {
    add(new THREE.ConeGeometry(0.42, 2.4, 10), hull, 0, 0.1, -0.2).rotation.x = -Math.PI / 2;
    add(wingGeo(1.6, 0.95, 0.7, 0.08, 0.2), hull, 0, -0.05, 0.35);
    add(new THREE.BoxGeometry(0.09, 0.18, 1.0), trim, -1.5, 0.02, 0.8); add(new THREE.BoxGeometry(0.09, 0.18, 1.0), trim, 1.5, 0.02, 0.8);
    add(new THREE.SphereGeometry(0.26, 16, 12), glass, 0, 0.3, -0.25).scale.set(1, 0.8, 2.1);
    add(new THREE.BoxGeometry(1.2, 0.06, 0.12), trim, 0, 0.12, 0.4);
    add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 10), dark, -0.3, 0.05, 1.0).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 10), dark, 0.3, 0.05, 1.0).rotation.x = Math.PI / 2;
    eng = [[-0.3, 1.3], [0.3, 1.3]];
  } else if (id === 'manta') {
    add(new THREE.SphereGeometry(0.7, 20, 14), hull, 0, 0.05, 0).scale.set(1.0, 0.38, 1.9);
    const s = new THREE.Shape(); s.moveTo(0, 0.9); s.quadraticCurveTo(1.2, 0.8, 2.2, -0.4); s.quadraticCurveTo(1.2, -0.3, 0.6, -0.9); s.lineTo(-0.6, -0.9); s.quadraticCurveTo(-1.2, -0.3, -2.2, -0.4); s.quadraticCurveTo(-1.2, 0.8, 0, 0.9);
    const wg = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); wg.rotateX(-Math.PI / 2); add(wg, hull, 0, -0.04, 0.2);
    add(new THREE.SphereGeometry(0.12, 10, 8), trim, -2.1, 0.03, 0.6); add(new THREE.SphereGeometry(0.12, 10, 8), trim, 2.1, 0.03, 0.6);
    add(new THREE.SphereGeometry(0.26, 16, 12), glass, 0, 0.26, -0.5).scale.set(1, 0.7, 1.6);
    add(new THREE.BoxGeometry(0.06, 0.4, 0.7), trim, -0.45, 0.22, 0.9); add(new THREE.BoxGeometry(0.06, 0.4, 0.7), trim, 0.45, 0.22, 0.9);
    eng = [[-0.45, 1.25], [0.45, 1.25]];
  } else if (id === 'twin') {
    for (const sx of [-0.65, 0.65]) { add(new THREE.ConeGeometry(0.3, 2.4, 10), hull, sx, 0.05, -0.1).rotation.x = -Math.PI / 2; add(new THREE.BoxGeometry(0.08, 0.1, 1.6), trim, sx * 1.42, 0, 0.1); add(new THREE.CylinderGeometry(0.17, 0.22, 0.5, 10), dark, sx, 0.05, 1.15).rotation.x = Math.PI / 2; }
    add(new THREE.BoxGeometry(1.3, 0.12, 0.55), hull, 0, 0.05, 0.3);
    add(wingGeo(1.25, 0.7, 0.5, 0.06), hull, 0, -0.04, 0.7);
    add(new THREE.SphereGeometry(0.24, 16, 12), glass, 0, 0.22, 0.05).scale.set(1, 0.8, 1.7);
    add(new THREE.BoxGeometry(0.8, 0.05, 0.08), trim, 0, 0.14, -0.3);
    eng = [[-0.65, 1.45], [0.65, 1.45]];
  } else {
    add(new THREE.SphereGeometry(0.55, 20, 14), hull, 0, 0.05, 0.1).scale.set(1, 0.7, 1.2);
    add(new THREE.ConeGeometry(0.3, 1.3, 10), hull, 0, 0.05, -0.85).rotation.x = -Math.PI / 2;
    const tor = add(new THREE.TorusGeometry(1.25, 0.11, 10, 48), trim, 0, 0, 0.15); tor.rotation.x = Math.PI / 2; g.spinner = tor;
    for (const a of [0, 2.1, -2.1]) { const f = add(new THREE.BoxGeometry(0.08, 0.08, 1.2), hull, Math.sin(a) * 0.7, 0, 0.15 + Math.cos(a) * 0.7); f.rotation.y = a; }
    add(new THREE.SphereGeometry(0.22, 16, 12), glass, 0, 0.32, -0.05).scale.set(1, 0.8, 1.4);
    eng = [[0, 0.95]];
  }
  g.engines = eng.map(([x, z]) => { const s = ownSprite(sch.trim, 1.1); s.position.set(x, 0.05, z + 0.15); g.add(s); const c = ownSprite('#ffffff', 0.45); c.position.set(x, 0.06, z + 0.05); g.add(c); return { x, z, s }; });
  const aura = ownSprite(sch.trim, 4.5, GLOW, 0.13); aura.position.y = -0.3; g.add(aura);
  return g;
}
function buildDrone(color, mini) {
  const g = new THREE.Group(), hull = std('#1d1a33'), trim = emi(color, 1.6);
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.ConeGeometry(0.3, 1.5, 8), hull, 0, 0.05, -0.1).rotation.x = -Math.PI / 2;
  add(wingGeo(0.95, 0.55, 0.35, 0.06, 0.1), trim, 0, -0.02, 0.3);
  add(new THREE.SphereGeometry(0.11, 12, 10), std('#0b1030', { emissive: color, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 }), 0, 0.15, -0.2).scale.set(1, 0.7, 1.8);
  g.trim = trim;
  g.eng = ownSprite(color, 0.9); g.eng.position.set(0, 0.05, 0.75); g.add(g.eng);
  g.aura = ownSprite(color, 2.6, GLOW, 0.16); g.aura.position.y = -0.2; g.add(g.aura);
  g.bubble = ownSprite(color, 2.2, BUBBLE, 0); g.add(g.bubble);
  g.beacon = ownSprite('#ffffff', 1.2, GLOW, 0); g.beacon.position.set(0, 1.1, 0); g.add(g.beacon);
  if (mini) g.scale.setScalar(0.5);
  return g;
}
const G = { oct: new THREE.OctahedronGeometry(0.55), torus: new THREE.TorusGeometry(0.8, 0.07, 8, 32), cone: new THREE.ConeGeometry(0.42, 1.4, 8), fin: new THREE.BoxGeometry(1.4, 0.06, 0.35), tank: rounded(1.9, 0.6, 1.5, 0.2), turret: new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8), eye: new THREE.SphereGeometry(0.22, 12, 10), core: new THREE.SphereGeometry(1.5, 28, 20), bring: new THREE.TorusGeometry(3.1, 0.32, 12, 64), pod: new THREE.SphereGeometry(0.6, 16, 12), plate: rounded(1.4, 0.4, 0.9, 0.12) };

// ------------------------------------------------------------------ game state
let state = 'attract';   // attract | play | dying
const run = { score: 0, wave: 1, kills: 0, combo: 0, comboT: 0, bestCombo: 0, agentKills: 0 };
const pl = { g: null, x: 0, z: 0, tx: 0, tz: 0, vx: 0, hull: 3, shield: 1, inv: 0, fireT: 0, mega: 0, over: 0, seekT: 0, trailT: 0, bubble: null, megaBeam: null };
let superM = 0;
const enemies = [], bolts = [], ebullets = [], missiles = [];
const wave = { n: 1, groups: 0, groupT: 1, boss: null, nextT: 0, escortT: 0 };
// the rival's squadron in a live duel (null rival = the game is exactly the solo game)
const RV = { r: null, key: null, ships: new Map(), kills: 0, mine: 0, dirty: false, syncT: 0, slowT: 2 };

function rebuildShip() {
  const p = pl.g ? pl.g.position.clone() : new THREE.Vector3(0, 0, F.zBot - 4);
  if (pl.g) scene.remove(pl.g);
  pl.g = buildShip(shipDef().id, scheme()); pl.g.position.copy(p); scene.add(pl.g);
  if (!pl.bubble) { pl.bubble = ownSprite('#4ef2ff', 3.6, BUBBLE, 0.0); scene.add(pl.bubble); }
  pl.bubble.material.color.set(scheme().trim);
}
pl.z = pl.tz = F.zBot - 4; rebuildShip();
pl.megaBeam = makeBeam('#ffd23f'); pl.megaBeam.visible = false; scene.add(pl.megaBeam);

// ------------------------------------------------------------------ enemies
const hpScale = () => 1 + (wave.n - 1) * 0.25, spScale = () => Math.min(1.8, 1 + (wave.n - 1) * 0.045);
function makeEnemy(type, x, z) {
  const g = new THREE.Group(), mats = [], m = (c, i) => { const mm = emi(c, i); mats.push([mm, i]); return mm; };
  const e = { type, g, x, z, vx: 0, vz: 0, t: Math.random() * 10, mats, flash: 0, scanned: 0, ret: null, fireT: 1.5 + Math.random() * 2.5, dead: false, phase: Math.random() * TAU };
  if (type === 'drone') {
    const core = new THREE.Mesh(G.oct, m('#ff3d7f', 0.7)), r = new THREE.Mesh(G.torus, m('#ffb3d0', 1.6)); r.rotation.x = Math.PI / 2 - 0.3; g.add(core, r); e.spin = core; e.ringM = r;
    Object.assign(e, { hp: 6, r: 0.85, speed: 0.085, score: 50, color: '#ff3d7f' });
  } else if (type === 'dart') {
    const c = new THREE.Mesh(G.cone, m('#ff8a3d', 0.8)); c.rotation.x = Math.PI / 2; const f = new THREE.Mesh(G.fin, m('#ffd23f', 1.4)); f.position.z = -0.3; g.add(c, f); e.spin = null;
    Object.assign(e, { hp: 3, r: 0.7, speed: 0.09, score: 75, color: '#ff8a3d', locked: false });
  } else if (type === 'tank') {
    const b = new THREE.Mesh(G.tank, m('#7b3dff', 0.45)); const t1 = new THREE.Mesh(G.turret, m('#c9b3ff', 1)), t2 = t1.clone(); t1.rotation.x = t2.rotation.x = Math.PI / 2; t1.position.set(-0.55, 0.3, 0.5); t2.position.set(0.55, 0.3, 0.5);
    const eye = new THREE.Mesh(G.eye, m('#ff3d7f', 2)); eye.position.set(0, 0.35, 0.1); g.add(b, t1, t2, eye);
    Object.assign(e, { hp: 26, r: 1.25, speed: 0.04, score: 200, color: '#a070ff' });
  } else {
    const core = new THREE.Mesh(G.core, m('#ff2255', 0.9)), br = new THREE.Mesh(G.bring, m('#ff9a3d', 1.3)); br.rotation.x = Math.PI / 2;
    const ringG = new THREE.Group(); ringG.add(br);
    for (let i = 0; i < 4; i++) { const pd = new THREE.Mesh(G.pod, m('#ffd23f', 1.8)); const a = i * TAU / 4; pd.position.set(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1); ringG.add(pd); const pl8 = new THREE.Mesh(G.plate, m('#4a1d6e', 0.3)); pl8.position.set(Math.cos(a + 0.78) * 1.9, 0.2, Math.sin(a + 0.78) * 1.9); pl8.rotation.y = -a; ringG.add(pl8); }
    g.add(core, ringG); e.spin = ringG; e.core = core;
    Object.assign(e, { hp: 480, r: 3.0, speed: 0.05, score: 3000, color: '#ff2255', radialT: 2, aimT: 1.2 });
    g.scale.setScalar(0.1);
  }
  const glow = ownSprite(e.color, e.r * 3.2, GLOW, 0.35); glow.position.y = -0.2; g.add(glow); e.glow = glow;
  e.hp *= type === 'boss' ? 1 + (wave.n / 5 - 1) * 0.6 : hpScale(); e.max = e.hp; e.speed *= spScale();
  g.position.set(x, 0, z); scene.add(g); enemies.push(e); return e;
}
function removeEnemy(e) {
  e.dead = true; scene.remove(e.g); e.mats.forEach(([mm]) => mm.dispose()); e.glow.material.dispose(); if (e.ret) { unspr(e.ret); e.ret = null; }
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  if (e === wave.boss) { wave.boss = null; $('#bosshp').classList.remove('on'); }
}
function nearest(x, z, maxD = 1e9) { let b = null, bd = maxD; for (const e of enemies) { if (e.dead || e.z < F.zTop - 3) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; b = e; } } return b; }
function hitE(e, dmg, color = '#fff', by = null) {
  if (e.dead) return;
  if (e.scanned > 0) dmg *= 2;
  e.hp -= dmg; e.flash = 5;
  if (e.hp <= 0) kill(e, by);
}
function kill(e, by) {
  if (e.dead) return;
  const sz = e.type === 'boss' ? 4 : e.type === 'tank' ? 1.8 : 1;
  boom(e.x, e.z, by && by.rival ? by.color : e.color, sz);
  // live duel: a kill by the rival's squadron scores for THEM in the kill race, never for the player's run
  if (by && by.rival) {
    RV.kills++; by.kills++; RV.dirty = true;
    if (e.type === 'boss') { banner(`${RV.r ? RV.r.name.toUpperCase() : 'RIVAL'} TOOK THE MOTHERSHIP`, `${by.name} landed the last hit`, by.color); shake(1.2); }
    else popAt(e.x, e.z, `${by.name} +1`, by.color, e.type === 'tank' ? 16 : 12);
    removeEnemy(e); return;
  }
  if (RV.r) { RV.mine++; RV.dirty = true; }
  if (e.type === 'boss') { for (let i = 1; i < 7; i++) setTimeout(() => boom(e.x + (Math.random() - 0.5) * 6, e.z + (Math.random() - 0.5) * 5, ['#ffd23f', '#ff2255', '#ffffff'][i % 3], 2), i * 140); hitStop = 14; shake(1.6); flash('#fff', 0.7); punch = 1; banner('MOTHERSHIP DOWN', `+${fmt(e.score * Math.max(1, wave.n / 5))}`, '#ffd23f'); }
  else if (e.type === 'tank') { hitStop = Math.max(hitStop, 3); }
  if (state === 'play') {
    run.combo++; run.comboT = 2.2; run.bestCombo = Math.max(run.bestCombo, run.combo); run.kills++;
    const mult = 1 + Math.min(4, Math.floor(run.combo / 8) * 0.5), pts = Math.round(e.score * mult * (e.type === 'boss' ? Math.max(1, wave.n / 5) : 1));
    run.score += pts; if (by) { by.kills = (by.kills || 0) + 1; run.agentKills++; }
    if (pts >= 150 || run.combo % 10 === 0) popAt(e.x, e.z, '+' + fmt(pts), run.combo >= 10 ? '#ffd23f' : '#fff', pts >= 1000 ? 26 : 16);
    addSuper(0.006);
  }
  removeEnemy(e);
}
function spawnGroup() {
  const z0 = F.zTop - 2, W = F.W * 0.82, r = Math.random(), n = wave.n;
  if (n >= 3 && r < 0.17) { makeEnemy('tank', (Math.random() * 2 - 1) * W * 0.8, z0); return; }
  if (n >= 2 && r < 0.45) { const c = (Math.random() * 2 - 1) * (W - 2), k = n >= 6 ? 4 : 3; for (let i = 0; i < k; i++) makeEnemy('dart', c + (i - (k - 1) / 2) * 1.6, z0 - i * 0.8); return; }
  const c = (Math.random() * 2 - 1) * (W - 3), k = n >= 4 ? 5 : 4 + (Math.random() < 0.5 ? 1 : 0);
  if (Math.random() < 0.5) for (let i = 0; i < k; i++) makeEnemy('drone', c + (i - (k - 1) / 2) * 1.5, z0 - Math.abs(i - (k - 1) / 2) * 1.2);
  else for (let i = 0; i < k; i++) makeEnemy('drone', c, z0 - i * 1.7);
}
function startWave(n) {
  wave.n = n; wave.nextT = 0;
  if (n % 5 === 0) { wave.groups = 0; const b = makeEnemy('boss', 0, F.zTop - 3); wave.boss = b; $('#bosshp').classList.add('on'); wave.escortT = 4; if (state === 'play') banner('WARNING', 'mothership incoming', '#ff2255'); }
  else { wave.groups = 6 + Math.round(n * 1.5); wave.groupT = 0.6; if (state === 'play') banner('WAVE ' + n, n === 1 ? 'your fleet is with you' : '', '#4ef2ff'); }
  if (state === 'play') SFX.wave();
  $('#wave').textContent = 'WAVE ' + n;
}
function ebullet(x, z, vx, vz) { if (ebullets.length > 240) return; const s = spr('#ff5a4a', 0.85); s.position.set(x, 0.35, z); const c = spr('#ffe0d0', 0.32); c.position.set(x, 0.36, z); ebullets.push({ s, c, x, z, vx, vz }); }
function aimAt(x, z, sp, spread = 0) { const dx = pl.x - x, dz = pl.z - z, d = Math.hypot(dx, dz) || 1, a = Math.atan2(dz, dx) + spread; ebullet(x, z + 0.5, Math.cos(a) * sp, Math.sin(a) * sp); }
function updEnemies(dt, sec) {
  const bsp = 0.13 + wave.n * 0.004;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]; e.t += sec;
    if (e.bombT != null) { e.bombT -= sec; if (e.bombT <= 0) { e.bombT = null; kill(e, e.bombBy); continue; } }
    if (e.type === 'drone') { e.z += e.speed * dt; e.x += Math.sin(e.t * 2 + e.phase) * 0.035 * dt; e.spin.rotation.y += 0.05 * dt; e.ringM.rotation.z += 0.08 * dt;
      if (wave.n >= 2 && e.z > F.zTop + 3 && e.z < pl.z - 6) { e.fireT -= sec; if (e.fireT <= 0) { e.fireT = 3.5 + Math.random() * 3 - Math.min(2, wave.n * 0.1); if (state !== 'attract') aimAt(e.x, e.z, bsp); } } }
    else if (e.type === 'dart') {
      if (!e.locked) { e.z += e.speed * dt; if (e.z > F.zTop + 6 + (e.phase % 3)) { e.locked = true; const dx = pl.x - e.x, dz = pl.z - e.z, d = Math.hypot(dx, dz); const sp = 0.2 * spScale(); e.vx = dx / d * sp; e.vz = dz / d * sp; part(e.x, 0.3, e.z, '#ffd23f', 2.2, { life: 0.25 }); } }
      else { e.x += e.vx * dt; e.z += e.vz * dt; if (e.t % 0.06 < sec) part(e.x, 0.3, e.z - 0.6, '#ff8a3d', 0.6, { life: 0.3, grow: 0.2 }); }
      e.g.rotation.y = e.locked ? Math.atan2(e.vx, e.vz) : 0;
    } else if (e.type === 'tank') {
      const hold = F.zTop + (F.zBot - F.zTop) * 0.3;
      if (e.z < hold || e.t > 12) e.z += e.speed * dt * (e.t > 12 ? 1.6 : 1); e.x += Math.sin(e.t * 0.7 + e.phase) * 0.03 * dt;
      e.fireT -= sec; if (e.fireT <= 0 && e.z > F.zTop + 2) { e.fireT = Math.max(1.0, 2.4 - wave.n * 0.06); if (state !== 'attract') { aimAt(e.x - 0.55, e.z, bsp * 1.1); aimAt(e.x + 0.55, e.z, bsp * 1.1); } }
    } else {
      const hold = F.zTop + 7; const s0 = e.g.scale.x; if (s0 < 1) e.g.scale.setScalar(Math.min(1, s0 + 0.02 * dt));
      if (e.z < hold) e.z += 0.06 * dt; else e.x = lerp(e.x, Math.sin(e.t * 0.45) * F.W * 0.5, 0.02 * dt);
      e.spin.rotation.y += 0.012 * dt; e.core.scale.setScalar(1 + Math.sin(e.t * 5) * 0.05);
      if (e.z >= hold - 1 && state !== 'attract') {
        e.radialT -= sec; e.aimT -= sec;
        if (e.radialT <= 0) { e.radialT = Math.max(1.4, 2.6 - wave.n * 0.04); const k = 14 + Math.min(10, wave.n), off = e.t; for (let j = 0; j < k; j++) { const a = off + j * TAU / k; ebullet(e.x + Math.cos(a) * 2, e.z + Math.sin(a) * 2, Math.cos(a) * bsp * 0.8, Math.sin(a) * bsp * 0.8); } }
        if (e.aimT <= 0) { e.aimT = 1.3; for (const s of [-0.2, 0, 0.2]) aimAt(e.x, e.z + 1.5, bsp * 1.2, s); }
      }
      $('#bosshp i').style.width = Math.max(0, e.hp / e.max * 100) + '%';
    }
    if (e.dead) continue;
    if (e.scanned > 0) { e.scanned -= sec; if (!e.ret) e.ret = spr('#ffd23f', e.r * 2.8, e.r * 2.8, 0.95, RETICLE); e.ret.position.set(e.x, 0.6, e.z); e.ret.material.rotation += 0.05 * dt; e.ret.material.opacity = e.scanned < 1 ? e.scanned : 0.95; if (e.scanned <= 0) { unspr(e.ret); e.ret = null; } }
    if (e.flash > 0) e.flash -= dt;
    for (const [mm, base] of e.mats) mm.emissiveIntensity = e.flash > 0 ? 4 : base;
    e.g.position.set(e.x, 0, e.z);
    if (e.z > F.zBot + 3 || Math.abs(e.x) > F.W + 12) { removeEnemy(e); continue; }
    const d = Math.hypot(e.x - pl.x, e.z - pl.z);
    if (d < e.r + 0.6 && state !== 'dying') { if (state === 'play') { hitPlayer(); hitE(e, e.type === 'boss' ? 2 : 6); } else if (e.type !== 'boss') kill(e); }
  }
}

// ------------------------------------------------------------------ player weapons
function bolt(x, z, vx, vz, dmg, color, size = 1, by = null) {
  if (bolts.length > 260) return;
  const s = spr(color, 0.34 * size, 1.25 * size); s.position.set(x, 0.3, z); const c = spr('#ffffff', 0.14 * size, 0.7 * size); c.position.set(x, 0.31, z);
  bolts.push({ s, c, x, z, vx, vz, dmg, by, color });
}
function missile(x, z, color, dmg = 3, by = null) {
  if (missiles.length > 140) return;
  const s = spr(color, 0.9), c = spr('#ffffff', 0.35); const a = (Math.random() - 0.5) * 2.2;
  missiles.push({ s, c, x, z, vx: Math.sin(a) * 0.22, vz: -Math.cos(a) * 0.22, color, dmg, by, life: 3.2, t: null, k: 0 }); SFX.missile();
}
function updWeapons(dt, sec) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]; b.x += b.vx * dt; b.z += b.vz * dt; b.s.position.set(b.x, 0.3, b.z); b.c.position.set(b.x, 0.31, b.z);
    let hit = null; for (const e of enemies) if (!e.dead && Math.abs(e.x - b.x) < e.r + 0.25 && Math.abs(e.z - b.z) < e.r + 0.5) { hit = e; break; }
    if (hit) { hitE(hit, b.dmg, b.color, b.by); part(b.x, 0.4, b.z, b.color, 1.4, { life: 0.12, grow: 0.4 }); if (Math.random() < 0.5) sparks(b.x, b.z, b.color, 2, 0.2, 0.3, 0.25); }
    if (hit || b.z < F.zTop - 8) { unspr(b.s); unspr(b.c); bolts.splice(i, 1); }
  }
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i]; m.life -= sec; m.k++;
    if (!m.t || m.t.dead) m.t = nearest(m.x, m.z);
    const sp = Math.min(0.7, Math.hypot(m.vx, m.vz) + 0.018 * dt);
    if (m.t) { const dx = m.t.x - m.x, dz = m.t.z - m.z, d = Math.hypot(dx, dz) || 1; m.vx = lerp(m.vx, dx / d * sp, Math.min(1, 0.13 * dt)); m.vz = lerp(m.vz, dz / d * sp, Math.min(1, 0.13 * dt)); }
    else { m.vz = lerp(m.vz, -sp, 0.1 * dt); m.vx *= 0.95; }
    const n = Math.hypot(m.vx, m.vz) || 1; m.vx = m.vx / n * sp; m.vz = m.vz / n * sp;
    m.x += m.vx * dt; m.z += m.vz * dt; m.s.position.set(m.x, 0.35, m.z); m.c.position.set(m.x, 0.36, m.z);
    if (m.k % 2 === 0) part(m.x, 0.3, m.z, m.color, 0.6, { life: 0.35, grow: 0.15, drag: 0.9 });
    let hit = null; for (const e of enemies) if (!e.dead && Math.hypot(e.x - m.x, e.z - m.z) < e.r + 0.35) { hit = e; break; }
    if (hit) { hitE(hit, m.dmg, m.color, m.by); part(m.x, 0.4, m.z, m.color, 3, { life: 0.25, grow: 0.3 }); sparks(m.x, m.z, m.color, 6, 0.25, 0.4, 0.35); ring(m.x, m.z, m.color, 1.6, 0.3); }
    if (hit || m.life <= 0 || m.z < F.zTop - 10 || Math.abs(m.x) > F.W + 10) { unspr(m.s); unspr(m.c); missiles.splice(i, 1); }
  }
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i]; b.x += b.vx * dt; b.z += b.vz * dt; b.s.position.set(b.x, 0.35, b.z); b.c.position.set(b.x, 0.36, b.z);
    let gone = b.z > F.zBot + 3 || b.z < F.zTop - 12 || Math.abs(b.x) > F.W + 10;
    if (!gone && state === 'play' && Math.hypot(b.x - pl.x, b.z - pl.z) < 0.6) { hitPlayer(); gone = true; }
    if (gone) { unspr(b.s); unspr(b.c); ebullets.splice(i, 1); }
  }
}
function clearBullets() { for (const b of ebullets) { sparks(b.x, b.z, '#ff8a6a', 2, 0.15, 0.3, 0.3); unspr(b.s); unspr(b.c); } ebullets.length = 0; }

// ------------------------------------------------------------------ player
const keys = {};
addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (state === 'play' && e.code === 'Space') triggerSuper(); else if (state === 'attract' && !$('#menu').hidden && cardHidden()) launch(); else if (state === 'attract' && !$('#over').hidden && cardHidden()) launch(); }
});
addEventListener('keyup', e => { keys[e.key] = false; });
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => {
  if (!drag || state !== 'play') { if (drag) { drag.x = e.clientX; drag.y = e.clientY; } return; }
  const k = (2 * F.W) / innerWidth * (portrait ? 1.5 : 1.25);
  pl.tx += (e.clientX - drag.x) * k; pl.tz += (e.clientY - drag.y) * k; drag.x = e.clientX; drag.y = e.clientY;
});
addEventListener('pointerup', () => drag = null); addEventListener('pointercancel', () => drag = null);

function hitPlayer() {
  if (state !== 'play' || pl.inv > 0 || pl.over > 0 || window.__god) return;
  if (pl.shield > 0) { pl.shield--; ring(pl.x, pl.z, scheme().trim, 3, 0.4); sparks(pl.x, pl.z, scheme().trim, 14, 0.3); }
  else { pl.hull--; sparks(pl.x, pl.z, '#ff4f6d', 20, 0.35); flash('#ff2244', 0.35); }
  pl.inv = 1.4; shake(0.8); hitStop = Math.max(hitStop, 5); SFX.hurt(); run.combo = 0; hud();
  if (pl.hull <= 0) die();
}
function die() {
  state = 'dying'; boom(pl.x, pl.z, scheme().trim, 3); boom(pl.x, pl.z, '#ffffff', 1.5); pl.g.visible = false; pl.bubble.material.opacity = 0;
  hitStop = 16; shake(1.8); flash('#ff2244', 0.5); pl.mega = 0; pl.over = 0;
  setTimeout(gameOver, 1700);
}
function triggerSuper() {
  if (superM < 1 || state !== 'play') return;
  superM = 0; pl.over = 4.5; pl.inv = Math.max(pl.inv, 4.5);
  banner('OVERDRIVE', 'super fired · every wingman launches', '#ffd23f'); SFX.super(); flash('#ffd23f', 0.35); shake(1); punch = 1;
  ring(pl.x, pl.z, '#ffd23f', 18, 0.8); ring(pl.x, pl.z, '#ff4fd8', 12, 0.6);
  for (let i = 0; i < 18; i++) setTimeout(() => state === 'play' && missile(pl.x, pl.z - 0.5, i % 2 ? '#ffd23f' : scheme().trim, 4), i * 110);
  for (const w of fleet.values()) for (let i = 0; i < (w.mini ? 2 : 4); i++) setTimeout(() => fleet.has(w.id) && missile(w.x, w.z, w.color, 3, w), i * 160 + Math.random() * 100);
  hud();
}
function addSuper(v) { const was = superM >= 1; superM = Math.min(1, superM + v); if (!was && superM >= 1 && state === 'play') { popAt(pl.x, pl.z - 2, 'SUPER READY', '#ffd23f', 18); SFX.ping(); } }
function updPlayer(dt, sec, t) {
  const sd = shipDef(), sch = scheme();
  if (state === 'play') {
    const kx = (keys.ArrowRight || keys.d || keys.D ? 1 : 0) - (keys.ArrowLeft || keys.a || keys.A ? 1 : 0), kz = (keys.ArrowDown || keys.s || keys.S ? 1 : 0) - (keys.ArrowUp || keys.w || keys.W ? 1 : 0);
    pl.tx += kx * 0.34 * dt; pl.tz += kz * 0.3 * dt;
  } else if (state === 'attract') {
    const tg = nearest(pl.x, pl.z); pl.tx = tg ? clamp(tg.x, -F.W, F.W) * 0.8 + Math.sin(t * 0.7) * 1.5 : Math.sin(t * 0.6) * F.W * 0.5; pl.tz = F.zBot - (portrait ? 10 : 8.5) + Math.sin(t * 0.9) * 0.6;
  }
  pl.tx = clamp(pl.tx, -F.W, F.W); pl.tz = clamp(pl.tz, F.zBot - 16, F.zBot - (portrait ? 8.5 : 6));
  if (state === 'dying') return;
  const ox = pl.x; pl.x = lerp(pl.x, pl.tx, Math.min(1, 0.3 * dt)); pl.z = lerp(pl.z, pl.tz, Math.min(1, 0.3 * dt));
  pl.vx = lerp(pl.vx, (pl.x - ox) / Math.max(dt, 0.01), 0.3);
  pl.g.position.set(pl.x, Math.sin(t * 3) * 0.08, pl.z); pl.g.rotation.z = clamp(-pl.vx * 1.6, -0.75, 0.75); pl.g.rotation.x = -0.05;
  if (pl.g.spinner) pl.g.spinner.rotation.z += 0.06 * dt;
  pl.g.visible = !(pl.inv > 0 && pl.over <= 0 && Math.floor(t * 18) % 2 === 0 && state === 'play');
  for (const en of pl.g.engines) en.s.scale.setScalar(1.0 + Math.random() * 0.35 + (pl.over > 0 ? 0.8 : 0));
  pl.trailT -= dt; if (pl.trailT <= 0) { pl.trailT = 1; for (const en of pl.g.engines) part(pl.x + en.x, 0.05, pl.z + en.z + 0.2, sch.trim, 0.55, { vz: 0.12, life: 0.35, grow: 0.15, drag: 0.97 }); }
  pl.bubble.position.set(pl.x, 0.2, pl.z); pl.bubble.material.opacity = lerp(pl.bubble.material.opacity, state === 'play' && pl.shield > 0 ? 0.35 + pl.shield * 0.12 + Math.sin(t * 6) * 0.05 : 0, 0.15);
  if (pl.inv > 0) pl.inv -= sec;
  // primary auto-fire (also in attract mode, so the menu has life behind it)
  pl.fireT -= dt;
  if (pl.fireT <= 0) {
    const over = pl.over > 0; pl.fireT = sd.rate / (over ? 2.4 : 1);
    const guns = over ? sd.guns.concat([[-1, 0.3, -0.18], [1, 0.3, 0.18]]) : sd.guns;
    for (const [gx, gz, ga] of guns) bolt(pl.x + gx, pl.z + gz - 0.9, ga, -1.05, sd.dmg, over ? '#ffd23f' : sch.trim);
  }
  if (sd.seeker) { pl.seekT -= sec; if (pl.seekT <= 0) { pl.seekT = 1.1; if (nearest(pl.x, pl.z)) missile(pl.x, pl.z, sch.trim, 2); } }
  if (pl.over > 0) { pl.over -= sec; if (Math.random() < 0.4) part(pl.x + (Math.random() - 0.5) * 2, 0.4, pl.z + (Math.random() - 0.5) * 2, '#ffd23f', 0.6, { life: 0.3 }); }
  // mega laser (deploy)
  const mb = pl.megaBeam;
  if (pl.mega > 0) {
    pl.mega -= sec; mb.visible = true; const w = 1.1 + Math.sin(t * 40) * 0.15 + (pl.mega < 0.5 ? (pl.mega - 0.5) * 2 : 0);
    placeBeam(mb, pl.x, pl.z - 1.0, pl.x, F.zTop - 10, Math.max(0.05, w)); mb.mats[0].opacity = 0.55; shk = Math.max(shk, 0.12);
    for (const e of enemies) if (!e.dead && e.z < pl.z && Math.abs(e.x - pl.x) < 1.3 + e.r * 0.7) { hitE(e, 0.32 * dt, '#ffd23f', megaBy); if (Math.random() < 0.3 * dt) sparks(e.x, e.z, '#ffd23f', 3, 0.3, 0.4, 0.3); }
    for (const b of ebullets) if (Math.abs(b.x - pl.x) < 1.4 && b.z < pl.z) b.z = 1e4;
    if (Math.random() < 0.5) part(pl.x + (Math.random() - 0.5) * 0.8, 0.4, pl.z - 1.3, '#fff3b0', 1.6, { life: 0.15 });
    SFX.zap();
  } else mb.visible = false;
}
let megaBy = null;

// ------------------------------------------------------------------ the fleet (your agents)
const AG_COLORS = ['#4ef2ff', '#ff4fd8', '#ffd23f', '#7cff6b', '#ff8a3d', '#a78bff', '#3dffc5', '#ff5d6c', '#5aa9ff', '#f4f1ff'];
const ACT = { edit: 'laser', run: 'rapid', read: 'scan', web: 'beam', test: 'bomb', commit: 'shield', deploy: 'mega', delegate: 'missile', other: 'missile' };
const ACT_NAME = { laser: 'LASER', rapid: 'RAPID FIRE', scan: 'SCANNER', beam: 'LONG BEAM', bomb: 'SMART BOMB', shield: 'SHIELDS UP', mega: 'MEGA LASER', missile: 'MISSILE' };
const fleet = new Map(); let colorI = 0;
const leads = () => [...fleet.values()].filter(w => !w.mini);
function wingFor(e, quiet) {
  let w = fleet.get(e.agent); if (w) return w;
  let lead = null;
  if (e.parent) { lead = fleet.get(e.parent) || wingFor({ agent: e.parent, parent: null, label: e.label, src: e.src }, quiet); }
  const color = lead ? lead.color : AG_COLORS[colorI++ % AG_COLORS.length];
  w = { id: e.agent, parent: lead ? lead.id : null, label: e.label || 'agent', src: e.src, color, mini: !!lead, hp: 3, down: 0, waiting: false, q: [], qT: 0, rapid: 0, rapidT: 0, pulse: 0, flick: 0, flickC: color, last: Date.now(), x: pl.x, z: F.zBot + 4, subs: [], kills: 0, hits: 0, status: '', statusT: 0, ang: Math.random() * TAU };
  w.g = buildDrone(color, w.mini); w.g.position.set(w.x, 0, w.z); scene.add(w.g);
  if (!w.mini) { w.tag = document.createElement('div'); w.tag.className = 'tag'; w.tag.style.setProperty('--c', color); w.tag.innerHTML = `<b>${esc(w.label)}${e.src === 'codex' ? ' ·cx' : ''}</b><i></i>`; $('#tags').appendChild(w.tag); }
  else lead.subs.push(w);
  fleet.set(w.id, w);
  if (!quiet) { ring(w.x, w.z, color, 2.5, 0.5); sparks(w.x, w.z, color, 10, 0.25); }
  return w;
}
function removeWing(w) {
  if (!fleet.has(w.id)) return;
  ring(w.x, w.z, w.color, 2.4, 0.4); sparks(w.x, w.z, w.color, 10, 0.3);
  scene.remove(w.g); w.g.traverse(o => o.material && o.material.dispose()); if (w.tag) w.tag.remove(); fleet.delete(w.id);
  if (w.parent) { const l = fleet.get(w.parent); if (l) l.subs = l.subs.filter(s => s !== w); }
  for (const s of w.subs.slice()) removeWing(s);
  renderWaitbar();
}
function setStatus(w, s, t = 1.6) { const tw = w.mini ? fleet.get(w.parent) : w; if (!tw) return; tw.status = s; tw.statusT = t; }
function hurt(w, cat) {
  w.flick = 0.7; w.flickC = '#ff3344'; sparks(w.x, w.z, '#ff5566', 8, 0.25, 0.35, 0.35); SFX.fail();
  if (cat === 'test') popAt(w.x, w.z, 'TESTS FAILED', '#ff6b6b', 14);
  if (w.down > 0) return;
  w.hp--;
  if (w.hp <= 0) { w.down = 5; w.hp = 3; boom(w.x, w.z, '#ff5566', 0.6); setStatus(w, 'REBOOTING', 5); }
}
function feedLine(w, html, bad = false) {
  const f = $('#feed'), d = document.createElement('div'); if (bad) d.className = 'bad';
  d.style.setProperty('--c', w.color); d.innerHTML = `<b>${esc(w.label)}${w.mini ? ' ›sub' : ''}</b> ${html}`; f.appendChild(d);
  while (f.children.length > 5) f.firstChild.remove();
  clearTimeout(d._t); setTimeout(() => d.remove(), 6000);
}
function act(e) {
  const w = wingFor(e); w.last = Date.now();
  if (e.kind !== 'done' && e.kind !== 'end' && e.kind !== 'tokens' && w.waiting) { w.waiting = false; renderWaitbar(); }
  switch (e.kind) {
    case 'tool': w.pulse = 1; if (w.q.length < 10) w.q.push('pew'); setStatus(w, toolName(e.tool).toLowerCase(), 1.2); break;
    case 'think': w.pulse = Math.max(w.pulse, 0.5); break;
    case 'result':
      if (e.ok) { const a = ACT[e.cat] || 'missile'; if (w.q.length < 10 || a !== 'missile') w.q.push('missile'); if (a !== 'missile') w.q.push(a); w.hits++; feedLine(w, `${e.cat} ✔ → ${ACT_NAME[a]}`); }
      else { hurt(w, e.cat); feedLine(w, `${e.cat} ✗ failed → hit`, true); }
      break;
    case 'tokens': addSuper((e.tokens || 0) / 30000); w.pulse = Math.max(w.pulse, 0.3); break;
    case 'prompt': popAt(w.x, w.z - 0.5, 'ORDERS IN', w.color, 13); w.pulse = 1; break;
    case 'done': if (!w.mini) { w.waiting = true; w.waitSince = Date.now(); SFX.ping(); renderWaitbar(); popAt(w.x, w.z - 0.8, '✋ WAITING', w.color, 15); } break;
    case 'end': if (w.mini) removeWing(w); break;
  }
}
function renderWaitbar() {
  const ws = leads().filter(w => w.waiting).slice(0, portrait ? 2 : 3);
  $('#waitbar').innerHTML = ws.map(w => `<div style="--c:${w.color}">✋ <b>${esc(w.label)}</b> is waiting for your orders</div>`).join('');
}
function fireAct(w, a) {
  const x = w.x, z = w.z, by = w;
  switch (a) {
    case 'pew': bolt(x, z - 0.6, 0, -0.95, 0.7, w.color, w.mini ? 0.6 : 0.85, by); break;
    case 'missile': missile(x, z - 0.3, w.color, w.mini ? 2 : 3, by); break;
    case 'laser': { const t = nearest(x, z); if (t) { beam(x, z - 0.5, t.x, t.z, w.color, 0.22, 0.32); hitE(t, 6, w.color, by); sparks(t.x, t.z, w.color, 8, 0.3); } else beam(x, z - 0.5, x, z - 16, w.color, 0.2, 0.25); SFX.laser(); popAt(x, z - 0.6, 'LASER', w.color, 12); break; }
    case 'rapid': w.rapid = 0.9; popAt(x, z - 0.6, 'RAPID', w.color, 12); break;
    case 'scan': { ring(x, z, w.color, 16, 0.9, 0.5, 0.9); ring(x, z, '#ffffff', 10, 0.6, 0.3, 0.6); let n = 0; for (const e of enemies) if (Math.hypot(e.x - x, e.z - z) < 18) { e.scanned = 7; n++; } popAt(x, z - 0.6, n ? `SCAN · ${n} WEAK` : 'SCAN', '#ffd23f', 12); SFX.scan(); break; }
    case 'beam': { const zt = F.zTop - 10; beam(x, z - 0.6, x, zt, w.color, 0.45, 0.55); for (const e of enemies) if (e.z < z && Math.abs(e.x - x) < e.r + 0.55) { hitE(e, 5, w.color, by); sparks(e.x, e.z, w.color, 5, 0.25); } SFX.laser(); break; }
    case 'bomb': smartBomb(w); break;
    case 'shield': shieldsUp(w); break;
    case 'mega': pl.mega = 5; megaBy = w; banner('DEPLOYED', `mega laser · ${w.label}`, w.color); flash(w.color, 0.25); punch = 0.6; break;
  }
}
function smartBomb(w) {
  banner('TESTS PASSED', `smart bomb · ${w.label}`, '#ffffff'); SFX.bomb(); flash('#ffffff', 0.75); shake(1.4); hitStop = Math.max(hitStop, 7); punch = 1;
  ring(pl.x, pl.z, '#ffffff', 70, 1.1, 1); ring(w.x, w.z, w.color, 50, 0.9, 1); ring(pl.x, pl.z, '#ffd23f', 35, 0.7, 1);
  for (const e of enemies) { if (e.type === 'boss') { hitE(e, e.max * 0.12, '#fff', w); boom(e.x, e.z, '#ffffff', 2); } else { e.bombT = 0.08 + Math.hypot(e.x - pl.x, e.z - pl.z) * 0.015; e.bombBy = w; } }
  clearBullets();
}
function shieldsUp(w) {
  banner('COMMITTED', `shields recharged · ${w.label}`, '#7cff6b'); SFX.shield();
  for (const o of fleet.values()) { o.hp = 3; o.down = 0; o.flick = 0.9; o.flickC = '#7cff6b'; }
  if (state === 'play') pl.shield = Math.min(3, pl.shield + 1);
  ring(pl.x, pl.z, '#7cff6b', 5, 0.6); ring(pl.x, pl.z, '#ffffff', 3.5, 0.4); hud();
}
function updFleet(dt, sec, t) {
  const L = leads(), n = L.length, maxRank = Math.max(1, Math.ceil(n / 2));
  const sx = Math.min(1.9, (F.W - 0.6) / maxRank), sz = n > 6 ? 0.8 : 1.15, now = Date.now();
  L.forEach((w, i) => {
    const rank = Math.floor(i / 2) + 1, side = i % 2 === 0 ? -1 : 1;
    let txp = pl.x + side * rank * sx, tzp = pl.z + 0.6 + rank * sz;
    txp = clamp(txp, -F.W - 1, F.W + 1);
    if (w.down > 0) { tzp += 1.5; }
    w.x = lerp(w.x, txp, Math.min(1, 0.09 * dt)); w.z = lerp(w.z, tzp + Math.sin(t * 2 + i) * 0.15, Math.min(1, 0.09 * dt));
  });
  for (const w of fleet.values()) {
    if (w.mini) { const l = fleet.get(w.parent); if (!l) continue; const k = l.subs.indexOf(w); w.ang += 0.045 * dt; const a = w.ang + k * TAU / Math.max(1, l.subs.length); w.x = l.x + Math.cos(a) * 1.15; w.z = l.z + Math.sin(a) * 0.9; }
    const g = w.g; g.position.set(w.x, 0.15 + Math.sin(t * 3 + w.ang) * 0.08, w.z);
    if (w.down > 0) { w.down -= sec; g.rotation.y += 0.25 * dt; g.trim.emissiveIntensity = 0.1; if (Math.random() < 0.15) part(w.x, 0.3, w.z, '#777788', 0.7, { vz: 0.06, life: 0.5 }); if (w.down <= 0) { g.rotation.y = 0; ring(w.x, w.z, w.color, 2.2, 0.4); setStatus(w, 'ONLINE', 1.2); } }
    else { g.rotation.y = 0; g.rotation.z = clamp(-pl.vx * 1.2, -0.6, 0.6); g.trim.emissiveIntensity = 1.6 + w.pulse * 2.5; }
    w.pulse = Math.max(0, w.pulse - sec * 2.5);
    g.eng.scale.setScalar(0.9 + w.pulse * 0.9 + Math.random() * 0.2);
    if (w.flick > 0) { w.flick -= sec; g.bubble.material.color.set(w.flickC); g.bubble.material.opacity = Math.floor(t * 20) % 2 ? 0.9 * Math.min(1, w.flick * 2) : 0.15; } else g.bubble.material.opacity = 0;
    g.beacon.material.opacity = w.waiting ? (Math.floor(t * 3) % 2 ? 1 : 0.2) : 0;
    if (w.waiting) g.trim.emissiveIntensity = 1.6 + (Math.floor(t * 3) % 2) * 2;
    if (Math.random() < 0.5) part(w.x, 0.1, w.z + (w.mini ? 0.4 : 0.8), w.color, w.mini ? 0.3 : 0.45, { vz: 0.1, life: 0.3, grow: 0.15, drag: 0.97 });
    // weapon queue
    if (w.down <= 0) {
      w.qT -= sec;
      if (w.q.length && w.qT <= 0) { const a = w.q.shift(); fireAct(w, a); w.qT = a === 'pew' ? 0.08 : 0.16; w.pulse = 1; }
      if (w.rapid > 0) { w.rapid -= sec; w.rapidT -= dt; if (w.rapidT <= 0) { w.rapidT = 3; bolt(w.x + (Math.random() - 0.5) * 0.4, w.z - 0.6, (Math.random() - 0.5) * 0.08, -1.0, 0.8, w.color, w.mini ? 0.6 : 0.9, w); } }
    }
    // leave after idling
    const idle = now - w.last;
    if ((w.mini && idle > 4 * 60e3) || (!w.mini && !w.waiting && idle > 12 * 60e3) || (w.waiting && idle > 30 * 60e3)) removeWing(w);
  }
  // name tags
  for (const w of leads()) {
    const [x, y, vis] = toScreen(w.x, 0, w.z + 0.75);
    w.tag.style.transform = `translate(${x}px,${y}px) translate(-50%,0)`; w.tag.style.display = vis ? '' : 'none';
    w.statusT -= sec;
    const s = w.down > 0 ? 'REBOOTING' : w.waiting ? '✋ waiting for orders' : w.statusT > 0 ? w.status : '';
    if (w._s !== s) { w._s = s; w.tag.querySelector('i').textContent = s; w.tag.classList.toggle('wait', w.waiting && w.down <= 0); w.tag.classList.toggle('down', w.down > 0); }
  }
  $('#waiting').classList.toggle('on', n === 0);
}

// ------------------------------------------------------------------ the rival's squadron (live duel only)
// One ship per rival agent (max 5), flying a contest line ahead of you in the rival's colour. Their finished steps
// fire for them; every enemy they finish counts for them in the kill race ("You 12 : 9 🇹🇷 Yusuf").
const RVA = { edit: 'laser', run: 'rapid', read: 'scan', web: 'beam', test: 'bomb', commit: 'volley', deploy: 'mega', delegate: 'missile', other: 'missile' };
const RVA_NAME = { missile: 'MISSILE', laser: 'LASER', rapid: 'RAPID FIRE', scan: 'SCANNER', beam: 'LONG BEAM', bomb: 'SMART BOMB', volley: 'MISSILE VOLLEY', mega: 'BIG BLAST' };
const rvCol = r => r.sim ? '#dfe4ec' : r.color;
const rvLive = r => r.sim || r.online;
function rvMake(a, r) {
  const col = rvCol(r), sch = r.sim ? { hull: '#9aa0ad', trim: '#e9edf3' } : { hull: '#' + new THREE.Color(col).multiplyScalar(0.62).getHexString(), trim: col };
  const s = { k: a.k, name: a.name, src: a.src, state: a.state, rival: true, color: col, x: 0, z: F.zTop - 3, q: [], qT: 0, rapid: 0, rapidT: 0, kills: 0, flick: 0, spin: 0, mega: 0, pulse: 0, status: '', statusT: 0, ph: Math.random() * TAU, i: 0 };
  s.g = buildShip(r.sim ? 'arrow' : 'manta', sch); s.g.scale.setScalar(0.74); scene.add(s.g);
  s.trims = []; s.g.traverse(o => { if (o.isMesh && o.material.emissiveIntensity >= 1.4) s.trims.push(o.material); });
  s.beacon = ownSprite('#ffffff', 1.6, GLOW, 0); s.beacon.position.set(0, 1.8, 0); s.g.add(s.beacon);
  s.beam = makeBeam(col); s.beam.visible = false; scene.add(s.beam);
  s.tag = document.createElement('div'); s.tag.className = 'tag rv'; s.tag.style.setProperty('--c', col);
  s.tag.innerHTML = `<b>${r.flag} ${esc(a.name)}${a.src === 'codex' ? '<sup>CX</sup>' : ''}</b><i></i>`; $('#tags').appendChild(s.tag);
  return s;
}
function rvDrop(s) {
  ring(s.x, s.z, s.color, 2.4, 0.4); scene.remove(s.g); s.g.traverse(o => o.material && o.material.dispose());
  scene.remove(s.beam); s.beam.mats.forEach(m => m.dispose()); s.tag.remove(); RV.ships.delete(s.k);
}
function rvClear() { for (const s of [...RV.ships.values()]) rvDrop(s); RV.r = null; RV.key = null; document.body.classList.remove('duel'); $('#rvbar').innerHTML = ''; }
function rvSync() {
  const r = B && B.rival ? B.rival() : null;
  if (!r) { if (RV.r) rvClear(); return; }
  if (RV.key !== r.key) { rvClear(); RV.key = r.key; RV.kills = 0; RV.mine = 0; }
  RV.r = r; document.body.classList.add('duel');
  let ags = (r.agents || []).slice(0, 5);
  if (!ags.length) ags = [{ k: '_none', name: r.name, src: 'claude', state: 'idle', ph: true }];
  const keep = new Set(ags.map(a => a.k));
  for (const s of [...RV.ships.values()]) if (!keep.has(s.k)) rvDrop(s);
  ags.forEach((a, i) => {
    let s = RV.ships.get(a.k);
    if (!s) { s = rvMake(a, r); RV.ships.set(a.k, s); s.x = (i - (ags.length - 1) / 2) * 2.5; ring(s.x, s.z, s.color, 3, 0.6); }
    s.i = i; s.state = a.state; s.placeholder = !!a.ph; s.done = a.done || 0; s.sub = a.sub || 0;
  });
  rvPanel();
}
function rvPanel() {
  const r = RV.r; if (!r) return; RV.dirty = false;
  const ships = [...RV.ships.values()].filter(s => !s.placeholder), working = ships.filter(s => s.state === 'working').length;
  const st = r.sim ? 'simulated rival · silver squadron' : !r.online ? `😴 ${esc(r.name)} is offline · their squadron is parked` : !ships.length ? `waiting for ${esc(r.name)}'s agents…` : `🟢 ${working} of ${ships.length} agents working`;
  const lead = RV.mine > RV.kills ? 'me' : RV.kills > RV.mine ? 'them' : '';
  $('#rvbar').style.setProperty('--c', rvCol(r));
  $('#rvbar').innerHTML = `<div class="vs"><span class="me ${lead === 'me' ? 'lead' : ''}">YOU <b>${RV.mine}</b></span><em>KILL<br>RACE</em><span class="them ${lead === 'them' ? 'lead' : ''}"><b>${RV.kills}</b> ${r.flag} ${esc(r.name)}</span></div>
    ${ships.length ? `<div class="ros">${ships.map(s => `<span class="${s.state}"><i></i>${esc(s.name)}${s.src === 'codex' ? ' ·cx' : ''}${s.kills ? ` <small>${s.kills}☠</small>` : ''}</span>`).join('')}</div>` : ''}
    <div class="st">${st}</div>`;
}
function rvFeed(s, html, bad) {
  const f = $('#feed'), d = document.createElement('div'); d.className = 'rv' + (bad ? ' bad' : '');
  d.style.setProperty('--c', s.color); d.innerHTML = `${RV.r.flag} <b>${esc(RV.r.name)}'s ${esc(s.name)}</b> ${html}`; f.appendChild(d);
  while (f.children.length > 5) f.firstChild.remove();
  setTimeout(() => d.remove(), 6000);
}
function rvEvent(e) {
  const r = RV.r; if (!r) return;
  const s = RV.ships.get(e.agent.k) || [...RV.ships.values()].find(x => !x.placeholder); if (!s) return;
  s.statusT = 1.6;
  if (!e.ok) { s.flick = 0.8; s.spin = 1.1; s.status = '✗ error'; s.q.length = 0; sparks(s.x, s.z, '#ff5566', 10, 0.25, 0.35, 0.4); popAt(s.x, s.z - 0.6, '✗ MISFIRE', '#ff6b6b', 12); rvFeed(s, `${e.cat} ✗ → misfire, spins out`, true); SFX.fail(); return; }
  const a = RVA[e.cat] || 'missile';
  if (s.q.length < 8) s.q.push('missile'); if (a !== 'missile') s.q.push(a);
  s.status = e.cat; s.pulse = 1;
  rvFeed(s, `${e.cat} ✔ → ${RVA_NAME[a]}`);
}
function rvFire(s, a) {
  const x = s.x, z = s.z, c = s.color, r = RV.r, who = `${r.name}'s ${s.name}`.toUpperCase();
  switch (a) {
    case 'missile': missile(x, z - 0.4, c, 3, s); break;
    case 'laser': { const t = nearest(x, z - 6); if (t) { beam(x, z - 0.5, t.x, t.z, c, 0.24, 0.32); hitE(t, 6, c, s); sparks(t.x, t.z, c, 8, 0.3); } else beam(x, z - 0.5, x, z - 16, c, 0.2, 0.25); SFX.laser(); popAt(x, z - 0.8, 'LASER', c, 12); break; }
    case 'rapid': s.rapid = 1; popAt(x, z - 0.8, 'RAPID', c, 12); break;
    case 'scan': { ring(x, z, c, 14, 0.9, 0.5, 0.9); let n = 0; for (const e of enemies) if (Math.hypot(e.x - x, e.z - z) < 15) { e.scanned = 6; n++; } popAt(x, z - 0.8, n ? `SCAN · ${n}` : 'SCAN', c, 12); SFX.scan(); break; }
    case 'beam': { beam(x, z - 0.6, x, F.zTop - 10, c, 0.45, 0.55); for (const e of enemies) if (e.z < z && Math.abs(e.x - x) < e.r + 0.55) hitE(e, 5, c, s); SFX.laser(); break; }
    case 'volley': popAt(x, z - 0.9, 'COMMIT VOLLEY', c, 14); ring(x, z, c, 5, 0.5); for (let i = 0; i < 6; i++) setTimeout(() => RV.ships.has(s.k) && missile(s.x, s.z - 0.3, c, 3, s), i * 120); break;
    case 'bomb': {
      let n = 0; for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.z - z); if (d > 12) continue; if (e.type === 'boss') hitE(e, e.max * 0.08, c, s); else if (e.bombT == null) { e.bombT = 0.1 + d * 0.03; e.bombBy = s; n++; } }
      banner(`${who} PASSES TESTS`, `rival smart bomb · ${n} caught`, c); ring(x, z, c, 24, 0.9, 1); ring(x, z, '#ffffff', 14, 0.6, 1); flash(c, 0.12); shake(0.8); SFX.bomb(); break;
    }
    case 'mega': {
      let n = 0; for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.z - (z - 4)); if (d > 10) continue; if (e.type === 'boss') hitE(e, e.max * 0.12, c, s); else if (e.bombT == null) { e.bombT = 0.15 + d * 0.04; e.bombBy = s; n++; } }
      s.mega = 3.2; boom(x, z - 2, c, 2.4); ring(x, z, c, 30, 1.1, 1); ring(x, z, '#ffffff', 18, 0.8, 1);
      banner(`${who} DEPLOYS!`, `big blast${n ? ` · ${n} enemies vaporised` : ''} · ${r.flag} ${r.name} +${n} in the race`, c); flash(c, 0.25); shake(1.3); punch = 0.5; hitStop = Math.max(hitStop, 5); SFX.super(); break;
    }
  }
}
function updRival(dt, sec, t) {
  const r = RV.r; if (!r) return;
  const live = rvLive(r), ships = [...RV.ships.values()], n = Math.max(1, ships.length);
  let zr = F.zTop + (F.zBot - F.zTop) * (portrait ? 0.4 : 0.36); const lane = Math.min(3.6, (F.W * 1.7) / n);
  // at the menu the panel covers the top of the field: fly the rival line just under it so they stay in sight
  const ov = !$('#menu').hidden ? $('#menu') : !$('#over').hidden ? $('#over') : null;
  if (ov && state !== 'play') { const b = ov.getBoundingClientRect().bottom + 64; zr = Math.min(pl.z - 2.6, Math.max(zr, groundAt(0, 1 - 2 * b / innerHeight).z)); }
  for (const s of ships) {
    const x0 = (s.i - (n - 1) / 2) * lane, off = !live || s.placeholder, wait = !off && s.state === 'waiting';
    let tx = x0 + Math.sin(t * 0.8 + s.ph) * 0.7, tz = zr + Math.sin(t * 1.1 + s.ph) * 0.4;
    if (off || wait) tz += 2.2;
    else { let best = null, bd = 1e9; for (const e of enemies) { if (e.dead || e.z > s.z - 1.5 || e.z < F.zTop - 1 || Math.abs(e.x - x0) > lane * 0.8 + 1) continue; const d = s.z - e.z; if (d < bd) { bd = d; best = e; } } if (best) tx = lerp(tx, best.x, 0.85); }
    for (const o of ships) if (o !== s && Math.abs(o.x - s.x) < 2.3 && Math.abs(o.z - s.z) < 2) tx += (s.i < o.i ? -1 : 1) * 1.2;   // keep the line readable
    tx = clamp(tx, -F.W, F.W);
    const ox = s.x; s.x = lerp(s.x, tx, Math.min(1, 0.06 * dt)); s.z = lerp(s.z, tz, Math.min(1, 0.05 * dt));
    const g = s.g; g.position.set(s.x, 0.25 + Math.sin(t * 2.6 + s.ph) * 0.1, s.z);
    g.rotation.z = clamp(-(s.x - ox) / Math.max(dt, 0.01) * 1.4, -0.6, 0.6);
    if (s.spin > 0) { s.spin -= sec; g.rotation.y += 0.35 * dt; } else g.rotation.y = 0;
    s.pulse = Math.max(0, s.pulse - sec * 2.5);
    const glow = off ? 0.2 : wait ? 0.8 + (Math.floor(t * 3) % 2) * 1.6 : 1.5 + s.pulse * 2.5;
    for (const m of s.trims) m.emissiveIntensity = s.flick > 0 && Math.floor(t * 20) % 2 ? 4 : glow;
    if (s.flick > 0) s.flick -= sec;
    for (const en of g.engines) en.s.scale.setScalar(off ? 0.5 : 1 + Math.random() * 0.3 + s.pulse * 0.6);
    s.beacon.material.opacity = wait ? (Math.floor(t * 3) % 2 ? 1 : 0.2) : 0;
    if (!off && Math.random() < 0.5) part(s.x, 0.1, s.z + 0.9, s.color, 0.45, { vz: 0.1, life: 0.3, grow: 0.15, drag: 0.97 });
    if (dt > 0 && s.spin <= 0) {
      s.qT -= sec;
      if (s.q.length && s.qT <= 0) { rvFire(s, s.q.shift()); s.qT = 0.22; s.pulse = 1; }
      if (s.rapid > 0) { s.rapid -= sec; s.rapidT -= dt; if (s.rapidT <= 0) { s.rapidT = 3; bolt(s.x + (Math.random() - 0.5) * 0.4, s.z - 0.7, (Math.random() - 0.5) * 0.08, -1.0, 0.8, s.color, 0.9, s); } }
    }
    const mb = s.beam;
    if (s.mega > 0 && dt > 0) {
      s.mega -= sec; mb.visible = true; placeBeam(mb, s.x, s.z - 0.8, s.x, F.zTop - 10, Math.max(0.05, 0.9 + Math.sin(t * 40) * 0.12 - (s.mega < 0.4 ? (0.4 - s.mega) * 2 : 0)));
      for (const e of enemies) if (!e.dead && e.z < s.z && Math.abs(e.x - s.x) < 1.1 + e.r * 0.7) hitE(e, 0.3 * dt, s.color, s);
      if (Math.random() < 0.5) part(s.x + (Math.random() - 0.5) * 0.8, 0.4, s.z - 1.1, '#ffffff', 1.4, { life: 0.15 });
    } else if (s.mega <= 0) mb.visible = false;
    // name tag: flag + callsign in their colour, state underneath
    const [px, py, vis] = toScreen(s.x, 0, s.z + 0.9);
    s.tag.style.transform = `translate(${px}px,${py}px) translate(-50%,0)`; s.tag.style.display = vis ? '' : 'none';
    s.statusT -= sec;
    const txt = s.placeholder ? (live ? 'no agents online yet' : '😴 offline') : !live ? '😴 offline' : wait ? '✋ waiting' : s.spin > 0 ? '✗ misfire' : s.statusT > 0 ? s.status : s.kills ? `${s.kills} ☠` : '';
    if (s._s !== txt) { s._s = txt; s.tag.querySelector('i').textContent = txt; s.tag.classList.toggle('off', off); s.tag.classList.toggle('wait', wait); }
  }
  // an offline rival's squadron only plinks slowly
  if (!live && dt > 0) { RV.slowT -= sec; if (RV.slowT <= 0) { RV.slowT = 3; const s = ships[(Math.random() * ships.length) | 0]; if (s) bolt(s.x, s.z - 0.7, 0, -0.9, 0.7, s.color, 0.8, s); } }
}

// ------------------------------------------------------------------ today (from the logs) + fleet XP (counted only)
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
let T = { hits: 0, fails: 0, tests: 0, commits: 0, deploys: 0, tokens: 0, agents: new Set() };
const resetT = () => { T = { hits: 0, fails: 0, tests: 0, commits: 0, deploys: 0, tokens: 0, agents: new Set() }; };
let countedN = 0, awayXP = 0;
function tallyEvent(e, info) {
  if (e.t >= today0()) {
    T.agents.add(e.parent || e.agent);
    if (e.kind === 'result') { if (e.ok) { T.hits++; if (e.cat === 'test') T.tests++; if (e.cat === 'commit') T.commits++; if (e.cat === 'deploy') T.deploys++; } else T.fails++; }
    if (e.kind === 'tokens') T.tokens += e.tokens || 0;
  }
  if (e.counted && !info.demo && !A.demo) {
    countedN++;
    let xp = 0; if (e.kind === 'result' && e.ok) xp = e.cat === 'test' ? 10 : e.cat === 'deploy' ? 15 : e.cat === 'commit' ? 5 : 1;
    if (xp) { P.xp += xp; if (info.backfill) awayXP += xp; }
  }
}
window.tally = { get xp() { return P.xp; }, get today() { return { ...T, agents: T.agents.size }; }, get counted() { return countedN; }, get fleet() { return fleet.size; } };

let B = null;
const A = agents({
  game: 'agent-shooter', title: 'WINGFLEET', accent: '#4ef2ff', demoAgents: 4,
  tagline: 'You fly. Your AI agents fly wingman.',
  about: 'Every live Claude Code or Codex session joins your squadron as a wingman drone. Its finished tool calls are your ammo: missiles, lasers, scanners and beams. Passing tests drop a smart bomb, commits recharge shields, deploys fire a mega laser, and tokens charge your super.',
  onEvents(list, info) {
    B && B.onAgentEvents(list);
    awayXP = 0;
    if (info.backfill && !info.demo) { for (const w of [...fleet.values()]) if (w.id.startsWith('d:')) removeWing(w); resetT(); colorI = 0; }
    for (const e of list) {
      tallyEvent(e, info);
      if (info.backfill) { if (e.live) { const w = wingFor(e, true); w.last = e.t; if (e.kind === 'done' && !w.mini) w.waiting = true; else if (e.kind !== 'tokens') w.waiting = false; if (e.kind === 'end' && w.mini) removeWing(w); } continue; }
      if (!e.live) continue;
      act(e);
    }
    if (info.backfill) { renderWaitbar(); if (awayXP > 0) toast(`While you were away your agents earned +${fmt(awayXP)} fleet XP`); saveP(); renderMenu(); }
    else if (countedN % 20 === 0) saveP();
  },
});
window.__A = A;
B = board({ game: 'agent-shooter', label: 'Points', A });
window.__B = B;
B.onRival(evs => { rvSync(); for (const e of evs) rvEvent(e); });
if (D.score > 0) B.submit(D.score);
const cardHidden = () => { const c = document.querySelector('.ag-card'); return !c || c.hidden; };

// ------------------------------------------------------------------ HUD + menus
function hud() {
  $('#score').textContent = fmt(run.score);
  $('#best').textContent = 'BEST ' + fmt(Math.max(P.best, run.score));
  let h = ''; for (let i = 0; i < 3; i++) h += `<span class="h ${i < pl.hull ? '' : 'off'}"></span>`; h += '<span style="width:6px"></span>'; for (let i = 0; i < 3; i++) h += `<span class="s ${i < pl.shield ? '' : 'off'}"></span>`;
  $('#hull').innerHTML = h;
}
let lastSuperPct = -1;
function hudFrame() {
  const pct = Math.floor(superM * 100);
  if (pct !== lastSuperPct) { lastSuperPct = pct; $('#super i').style.width = pct + '%'; $('#super span').textContent = superM >= 1 ? 'SUPER READY' : `SUPER ${pct}%`; $('#super').classList.toggle('ready', superM >= 1); }
  const c = $('#combo'); if (run.combo >= 3 && state === 'play') { const mult = 1 + Math.min(4, Math.floor(run.combo / 8) * 0.5); const s = `x${run.combo}<small>COMBO${mult > 1 ? ' · ' + mult + '× PTS' : ''}</small>`; if (c._s !== s) { c._s = s; c.innerHTML = s; } c.classList.add('on'); } else c.classList.remove('on');
  if (state === 'play') $('#score').textContent = fmt(run.score);
  if (RV.dirty) rvPanel();
}
function meLine() { const p = B.profile(); if (!p) return ''; let r = null; try { r = JSON.parse(localStorage.getItem('board_rank_agent-shooter')); } catch (e) {} return `${flag(p.country)} ${esc(p.name)}${r ? ` · #${r} today` : ''}`; }
const todayLine = () => T.agents.size ? `${A.demo ? 'Demo team' : 'Your agents'} today: ${fmt(T.hits)} hits · ${T.tests} tests passed · ${T.commits} commits · ${T.deploys} deploys` : 'Connect your agents: their work today becomes your firepower.';
function renderMenu() {
  const sd = shipDef(), sc = scheme();
  $('#ships').innerHTML = SHIPS.map(s => `<button data-ship="${s.id}" class="${s.ok() ? (s.id === sd.id ? 'on' : '') : 'lock'}">${s.ok() ? '' : '🔒 '}${s.name}<small>${s.ok() ? (s.id === 'arrow' ? 'twin guns' : s.id === 'manta' ? 'fast guns' : s.id === 'twin' ? 'triple spread' : 'seeker pods') : s.need}</small></button>`).join('');
  $('#swatches').innerHTML = SCHEMES.map((s, i) => `<button data-sc="${i}" title="${s.name}${P.kills >= s.need ? '' : ' · ' + s.need + ' kills'}" class="${P.kills >= s.need ? (s === sc ? 'on' : '') : 'lock'}" style="--c:${s.trim};background:radial-gradient(circle at 35% 35%,${s.trim},${s.hull} 75%)"></button>`).join('') + `<div class="swcap" style="width:100%">${sc.name} · ${fmt(P.kills)} lifetime kills${SCHEMES.find(s => P.kills < s.need) ? ` · next colour at ${fmt(SCHEMES.find(s => P.kills < s.need).need)}` : ''}</div>`;
  $('#rec').innerHTML = `Best ${fmt(P.best)} · wave ${P.bestWave} · ${fmt(P.xp)} fleet XP${P.streak > 1 ? ` · 🔥 ${P.streak}-day streak` : ''}`;
  $('#today').textContent = `Today: best ${fmt(D.score)} · ${D.runs} runs. ${todayLine()}`;
  $('#me').innerHTML = meLine();
  $('#ships').querySelectorAll('button').forEach(b => b.onclick = () => { const s = SHIPS.find(x => x.id === b.dataset.ship); if (!s.ok()) { toast(`🔒 ${s.name}: ${s.need}`); return; } P.ship = s.id; saveP(); rebuildShip(); renderMenu(); });
  $('#swatches').querySelectorAll('button').forEach(b => b.onclick = () => { const i = +b.dataset.sc; if (P.kills < SCHEMES[i].need) { toast(`🔒 ${SCHEMES[i].name}: ${SCHEMES[i].need} lifetime kills`); return; } P.scheme = i; saveP(); rebuildShip(); renderMenu(); });
}
function clearField() { for (const e of enemies.slice()) removeEnemy(e); clearBullets(); for (const b of bolts) { unspr(b.s); unspr(b.c); } bolts.length = 0; }
function launch() {
  audioOK = true; $('#menu').hidden = true; $('#over').hidden = true; document.body.classList.add('playing');
  clearField(); Object.assign(run, { score: 0, wave: 1, kills: 0, combo: 0, comboT: 0, bestCombo: 0, agentKills: 0 });
  Object.assign(pl, { hull: 3, shield: 1, inv: 1.5, mega: 0, over: 0, x: 0, tx: 0, z: F.zBot - 8, tz: F.zBot - (portrait ? 10 : 8.5) }); pl.g.visible = true;
  state = 'play'; startWave(1); hud(); for (const w of fleet.values()) w.kills = 0;
}
function unlockedNow() { return SHIPS.filter(s => s.ok()).map(s => s.name).concat(SCHEMES.filter(s => P.kills >= s.need).map(s => s.name + ' colours')); }
function gameOver() {
  const before = unlockedNow(), prevBest = P.best, prevDay = D.score;
  P.best = Math.max(P.best, run.score); P.bestWave = Math.max(P.bestWave, run.wave); P.kills += run.kills; P.runs++; P.bestCombo = Math.max(P.bestCombo, run.bestCombo);
  const dk = dayKey(); if (P.lastDay !== dk) { const y = new Date(); y.setDate(y.getDate() - 1); P.streak = P.lastDay === y.toLocaleDateString('en-CA') ? P.streak + 1 : 1; P.lastDay = dk; }
  D.score = Math.max(D.score, run.score); D.wave = Math.max(D.wave, run.wave); D.runs++; D.kills += run.kills;
  saveP();
  if (D.score > prevDay) B.submit(D.score);
  const fresh = unlockedNow().filter(x => !before.includes(x));
  $('#oScore').textContent = fmt(run.score);
  $('#oLine').textContent = `Wave ${run.wave} · ${run.kills} kills · best combo x${run.bestCombo}${run.agentKills ? ` · wingmen got ${run.agentKills}` : ''}${RV.r ? ` · kill race: you ${RV.mine} : ${RV.kills} ${RV.r.flag} ${RV.r.name}` : ''}`;
  $('#oBest').textContent = run.score > prevBest && run.score > 0 ? '★ NEW BEST RUN ★' : run.score > prevDay && run.score > 0 ? '★ BEST RUN TODAY ★' : '';
  $('#oUnl').innerHTML = fresh.map(f => `🔓 Unlocked: ${esc(f)}`).join('<br>');
  const me = meLine(); $('#oRank').innerHTML = me ? me : A.demo ? '' : '🏆 Open the board to join the world leaderboard';
  $('#oToday').textContent = `Today: best ${fmt(D.score)} · wave ${D.wave} · ${D.runs} runs. ${todayLine()}`;
  $('#over').hidden = false; document.body.classList.remove('playing'); state = 'attract'; pl.g.visible = true; pl.inv = 0;
  $('#bosshp').classList.remove('on'); clearField(); startWave(1); renderMenu();
}
$('#launch').onclick = launch; $('#again').onclick = launch;
$('#hangar').onclick = () => { $('#over').hidden = true; $('#menu').hidden = false; renderMenu(); };
$('#super').onclick = triggerSuper;
$('#bConnect').onclick = () => A.open(); $('#wConnect').onclick = e => { e.preventDefault(); A.open(); };
$('#bBoard').onclick = $('#oBoard').onclick = () => B.open();
$('#bShare').onclick = $('#oShare').onclick = () => shareCard();
const muteBtn = () => { $('#bMute').textContent = P.mute ? '🔇' : '🔊'; }; muteBtn();
$('#bMute').onclick = () => { P.mute = !P.mute; saveP(); muteBtn(); };
renderMenu(); hud();

// ------------------------------------------------------------------ share card
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
async function shareCard() {
  try { await document.fonts.load('900 60px Orbitron'); } catch (e) {}
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 1200, 630); bg.addColorStop(0, '#07051a'); bg.addColorStop(1, '#1e0b3c'); g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`; const s = Math.random() < 0.1 ? 3 : 1.5; g.fillRect(Math.random() * 1200, Math.random() * 630, s, s); }
  // live screenshot of the game
  renderer.render(scene, camera); const src = renderer.domElement, bx = 690, by = 40, bw = 470, bh = 550;
  const sa = src.width / src.height, ta = bw / bh; let sw = src.width, sh = src.height, sx = 0, sy = 0; if (sa > ta) { sw = sh * ta; sx = (src.width - sw) / 2; } else { sh = sw / ta; sy = (src.height - sh) / 2; }
  g.save(); rr(g, bx, by, bw, bh, 22); g.clip(); g.drawImage(src, sx, sy, sw, sh, bx, by, bw, bh); g.restore();
  g.lineWidth = 3; g.strokeStyle = '#4ef2ff'; g.shadowColor = '#4ef2ff'; g.shadowBlur = 18; rr(g, bx, by, bw, bh, 22); g.stroke(); g.shadowBlur = 0;
  g.font = '900 66px Orbitron, sans-serif'; g.fillStyle = '#4ef2ff'; g.shadowColor = '#4ef2ff'; g.shadowBlur = 26; g.fillText('WINGFLEET', 48, 104); g.shadowBlur = 0;
  g.font = '700 26px system-ui, sans-serif'; g.fillStyle = '#f4f1ff'; g.fillText(A.demo ? 'A demo squadron flew with me today' : 'My AI agents flew wingman today', 50, 146);
  const stats = [[fmt(T.hits), 'tool hits fired'], [T.tests, 'tests → smart bombs'], [T.commits, 'commits → shields'], [T.deploys, 'deploys → mega lasers'], [fmt(D.score), 'best run today'], [D.wave, 'best wave today']];
  stats.forEach(([v, l], i) => { const x = 50 + (i % 3) * 205, y = 186 + Math.floor(i / 3) * 128; g.fillStyle = 'rgba(255,255,255,.06)'; rr(g, x, y, 190, 112, 16); g.fill(); g.strokeStyle = 'rgba(78,242,255,.25)'; g.lineWidth = 1.5; g.stroke(); g.font = '900 40px Orbitron, sans-serif'; g.fillStyle = i >= 4 ? '#ffd23f' : '#ffffff'; g.fillText(String(v), x + 16, y + 56); g.font = '600 17px system-ui, sans-serif'; g.fillStyle = '#b9b2d8'; g.fillText(l, x + 16, y + 90); });
  let y = 480; const L = leads().slice(0, 5);
  if (L.length) { g.font = '700 15px system-ui'; g.fillStyle = '#8f86b8'; g.fillText('SQUADRON', 50, y); let x = 50; y += 32; g.font = '700 20px system-ui'; for (const w of L) { const label = w.label + (w.kills ? ` · ${w.kills}` : ''); g.fillStyle = w.color; g.shadowColor = w.color; g.shadowBlur = 10; g.beginPath(); g.arc(x + 8, y - 7, 8, 0, TAU); g.fill(); g.shadowBlur = 0; g.fillStyle = '#f4f1ff'; g.fillText(label, x + 22, y); x += g.measureText(label).width + 44; if (x > 620) break; } }
  const p = B.profile(); let rank = null; try { rank = JSON.parse(localStorage.getItem('board_rank_agent-shooter')); } catch (e) {}
  g.font = '700 22px system-ui, sans-serif'; g.fillStyle = '#ffd23f';
  g.fillText(p && !A.demo ? `${flag(p.country)} ${p.name}${rank ? ` · #${rank} in the world today` : ''}` : 'Fly with your own agents', 50, 590);
  g.font = '600 18px system-ui'; g.fillStyle = '#8f86b8'; g.textAlign = 'right'; g.fillText('agentpark.co', 650, 590); g.textAlign = 'left';
  c.toBlob(async b => {
    if (!b) return; const f = new File([b], 'wingfleet.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Wingfleet', text: 'My AI agents flew wingman today.' }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'wingfleet.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}
window.__share = shareCard;
window.__wf = { startWave: n => { run.wave = n; startWave(n); }, run, pl, enemies };

// ------------------------------------------------------------------ main loop
startWave(1);
loop((rawDt, t) => {
  const paused = state === 'play' && !cardHidden();
  let dt = paused ? 0 : rawDt;
  if (hitStop > 0) { hitStop -= rawDt; dt = 0; }
  const sec = dt / 60;
  // space
  const boost = 1 + (pl.over > 0 ? 3 : 0) + (pl.mega > 0 ? 1.5 : 0);
  for (const L of stars) { const p = L.pos; for (let i = 0; i < L.n; i++) { p[i * 3 + 2] += L.speed * Math.max(dt, paused ? 0 : 0.3) * boost; if (p[i * 3 + 2] > 40) p[i * 3 + 2] -= 210; } L.m.geometry.attributes.position.needsUpdate = true; }
  for (const n of nebula) { n.position.z += 0.012 * rawDt; if (n.position.z > 60) n.position.z -= 220; }
  planet.rotation.y += 0.0008 * rawDt; planet.position.z += 0.004 * rawDt; if (planet.position.z > 40) planet.position.z = -150;
  if (dt > 0) {
    updPlayer(dt, sec, t); updEnemies(dt, sec); updWeapons(dt, sec); updFleet(dt, sec, t); updRival(dt, sec, t); updFx(dt);
    // waves
    if (state !== 'dying') {
      if (wave.groups > 0) { wave.groupT -= sec; if (wave.groupT <= 0) { spawnGroup(); wave.groups--; wave.groupT = Math.max(0.65, 1.7 - wave.n * 0.1) * (state === 'attract' ? 1.2 : 1); } }
      if (wave.boss) { wave.escortT -= sec; if (wave.escortT <= 0) { wave.escortT = 6; spawnGroup(); } }
      if (wave.groups <= 0 && !wave.boss && enemies.length === 0) {
        wave.nextT += sec;
        if (wave.nextT > 1.2) { const nx = state === 'attract' ? (wave.n % 3) + 1 : wave.n + 1; if (state === 'play') { run.wave = nx; addSuper(0.05); if (nx % 5 === 1 && nx > 1) pl.shield = Math.min(3, pl.shield + 1); hud(); } startWave(nx); }
      }
    }
    if (run.comboT > 0) { run.comboT -= sec; if (run.comboT <= 0) run.combo = 0; }
  } else { updFleet(0, 0, t); updRival(0, 0, t); }
  RV.syncT -= rawDt / 60; if (RV.syncT <= 0) { RV.syncT = 1.5; rvSync(); }
  // camera: follow, shake, punch
  shk *= Math.pow(0.88, rawDt); punch *= Math.pow(0.9, rawDt);
  const sx = (Math.random() - 0.5) * shk, sy = (Math.random() - 0.5) * shk;
  const fx0 = pl.x * 0.12;
  camera.position.set(camBase.x + fx0 + sx, camBase.y + sy - punch * 3, camBase.z - punch * 2);
  camera.lookAt(camLook.x + fx0 + sx * 0.5, 0, camLook.z);
  hudFrame();
});

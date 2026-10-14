// Goo Lab: Slime Simulator ASMR — original DIY-slime game. Drip dyes into the glue and stir, pour activator into the
// stretchy zone, sprinkle the add-ins, then squish and poke the soft-body slime. Scored against the recipe card.
// Inspired by the mechanic of DIY slime ASMR simulators. All code and art original (three.js height-field soft body).
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, burst, confetti, store, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Goo Lab: Slime Simulator ASMR';
const $ = (id) => document.getElementById(id);
const ST = store('goolab');
const F = flow('goolab');
let level = ST.get('level', 1), best = ST.get('best', 0), score = ST.get('score', 0);
const ui = createUI({ title: 'GOO<br>LAB', hint: 'Mix · activate · squish!', hand: '🫧', score: false });
const D = daily('goolab', ui, { name: NAME });
const stage = createStage({ fov: 40, shadowSize: 4 });
const { scene, camera } = stage;
stage.followLight(new THREE.Vector3(0, 0, 0));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
document.body.style.background = 'radial-gradient(ellipse at 50% 45%, #f2fffb 0%, #bff0e4 45%, #8fd8f0 100%)';

// ------------------------------------------------------------------ own ASMR audio (noise squish)
let ax = null, noiseBuf = null;
function squish(vol = 0.2, freq = 700, dur = 0.18) {
  try {
    ax = ax || new (window.AudioContext || window.webkitAudioContext)(); if (ax.state === 'suspended') ax.resume();
    if (!noiseBuf) { noiseBuf = ax.createBuffer(1, ax.sampleRate * 0.5, ax.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i * 0.002)); }
    const s = ax.createBufferSource(), f = ax.createBiquadFilter(), g = ax.createGain(), n = ax.currentTime;
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 1.6, n); f.frequency.exponentialRampToValueAtTime(freq * 0.4, n + dur); f.Q.value = 4;
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    s.connect(f); f.connect(g); g.connect(ax.destination); s.start(n, Math.random() * 0.3); s.stop(n + dur + 0.05);
  } catch (e) {}
}
const pop = () => { tone(900 + Math.random() * 500, 0.04, 'sine', 0.12, 0.35); };

// ------------------------------------------------------------------ catalogue + pigment mixing (geometric mean ~ subtractive)
const DYES = [['#ff2d55', 'red'], ['#ffd60a', 'yellow'], ['#2f6bff', 'blue'], ['#ff5fc8', 'pink'], ['#22c97a', 'green'], ['#1d1b2f', 'black']];
const GLUE = [0.96, 0.96, 0.94], GLUE_W = 1.4;
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
function mixColor(counts) {
  const acc = [Math.log(GLUE[0]) * GLUE_W, Math.log(GLUE[1]) * GLUE_W, Math.log(GLUE[2]) * GLUE_W]; let w = GLUE_W;
  counts.forEach((n, i) => { if (!n) return; const c = rgb(DYES[i][0]); for (let k = 0; k < 3; k++) acc[k] += Math.log(Math.max(0.03, c[k])) * n; w += n; });
  return acc.map(a => Math.exp(a / w));
}
const hexOf = (c) => '#' + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const cdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ADDINS = ['beads', 'cubes', 'stars', 'berries'];
const NAMES1 = ['Galaxy', 'Unicorn', 'Ocean', 'Mango', 'Bubblegum', 'Matcha', 'Lava', 'Mermaid', 'Cloud', 'Grape', 'Sherbet', 'Pickle'];
const NAMES2 = ['Butter', 'Fluff', 'Jelly', 'Crunch', 'Dream', 'Goo', 'Glaze', 'Squish'];
const LINES = ['“Don\'t tell mum it\'s on the carpet.”', '“For science. Definitely science.”', '“My little brother is NOT touching this one.”', '“Slime of the week, let\'s go.”', '“If it sticks to the ceiling we start over.”', '“Smells like strawberries (allegedly).”'];

// ------------------------------------------------------------------ bowl + slime height field
const BR = 2.0;
const prof = [[0.0, -0.32], [BR * 0.85, -0.3], [BR + 0.02, -0.05], [BR + 0.08, 0.42], [BR + 0.28, 0.5], [BR + 0.38, 0.38], [BR + 0.3, -0.12], [BR * 0.9, -0.42], [0, -0.44]].map(([x, y]) => new THREE.Vector2(x, y));
const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), glossy('#ffffff', { roughness: 0.18, side: THREE.DoubleSide }));
bowl.castShadow = true; bowl.receiveShadow = true; scene.add(bowl);
const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.15 }));
shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = -0.45; shadowFloor.receiveShadow = true; scene.add(shadowFloor);

const N = 70, SR = BR - 0.02;
const geo = new THREE.PlaneGeometry(2, 2, N - 1, N - 1); geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position, U = new Float32Array(N * N), W = new Float32Array(N * N), RR = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) {
  const u = pos.getX(i), w = pos.getZ(i), x = u * Math.sqrt(1 - w * w / 2), z = w * Math.sqrt(1 - u * u / 2);
  U[i] = x * SR; W[i] = z * SR; RR[i] = Math.hypot(x, z); pos.setXYZ(i, U[i], 0, W[i]);
}
const Hd = new Float32Array(N * N), Hv = new Float32Array(N * N), Hn = new Float32Array(N * N);
const slC = document.createElement('canvas'); slC.width = slC.height = 512; const sx = slC.getContext('2d');
const slTex = new THREE.CanvasTexture(slC); slTex.colorSpace = THREE.SRGBColorSpace;
const slimeMat = new THREE.MeshPhysicalMaterial({ map: slTex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
const slime = new THREE.Mesh(geo, slimeMat); slime.receiveShadow = true; scene.add(slime);
const uvOf = (x, z) => [(x / SR + 1) / 2 * 512, (z / SR + 1) / 2 * 512];
let visc = 0, dome = 0, domeGoal = 0;      // visc 0 = runny glue, 1 = rubbery
function restH(i) { const r = RR[i]; return -0.18 + dome * Math.sqrt(Math.max(0, 1 - r * r)) * (0.85 + 0.15 * Math.cos(r * 9) * (1 - visc)) ; }
function stepSlime(dt) {
  // wave + spring + damping; runny glue ripples, slime oozes back slowly
  const c = 0.22 - 0.16 * visc, k = 0.004 + 0.012 * visc, damp = 0.94 - 0.08 * visc;
  for (let it = 0; it < 2; it++) {
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const p = j * N + i, lap = Hd[p - 1] + Hd[p + 1] + Hd[p - N] + Hd[p + N] - 4 * Hd[p];
      Hv[p] = (Hv[p] + (lap * c - Hd[p] * k) * dt) * damp;
    }
    for (let p = 0; p < N * N; p++) Hd[p] = RR[p] > 0.985 ? 0 : Hd[p] + Hv[p] * dt * 0.5;
  }
  for (let p = 0; p < N * N; p++) { const r = RR[p], edge = r > 0.93 ? (r - 0.93) / 0.07 : 0; pos.setY(p, restH(p) * (1 - edge) + edge * (0.05 + 0.12 * dome) + Hd[p] * (1 - edge)); }
  pos.needsUpdate = true; geo.computeVertexNormals();
}
function impulse(x, z, amt, rad = 0.45) {
  for (let p = 0; p < N * N; p++) { const d2 = (U[p] - x) ** 2 + (W[p] - z) ** 2; if (d2 < rad * rad * 4) Hd[p] += amt * Math.exp(-d2 / (rad * rad)); }
}
function heightAt(x, z) {
  let a = x / SR, b = z / SR; const r = Math.hypot(a, b); if (r > 0.999) { a *= 0.999 / r; b *= 0.999 / r; }
  // inverse of the square->disc mapping, then bilinear on the grid
  const t1 = 2 + a * a - b * b, t2 = 2 - a * a + b * b, s2 = 2 * Math.SQRT2;
  const u = 0.5 * Math.sqrt(Math.max(0, t1 + s2 * a)) - 0.5 * Math.sqrt(Math.max(0, t1 - s2 * a));
  const w = 0.5 * Math.sqrt(Math.max(0, t2 + s2 * b)) - 0.5 * Math.sqrt(Math.max(0, t2 - s2 * b));
  const fi = clamp((u + 1) / 2 * (N - 1), 0, N - 1.001), fj = clamp((w + 1) / 2 * (N - 1), 0, N - 1.001), i = Math.floor(fi), j = Math.floor(fj), di = fi - i, dj = fj - j;
  const h = (ii, jj) => pos.getY(jj * N + ii);
  return (h(i, j) * (1 - di) + h(i + 1, j) * di) * (1 - dj) + (h(i, j + 1) * (1 - di) + h(i + 1, j + 1) * di) * dj;
}

// ------------------------------------------------------------------ add-ins (instanced, ride on the surface)
const AG = {
  beads: new THREE.SphereGeometry(0.075, 12, 8), cubes: new THREE.BoxGeometry(0.17, 0.17, 0.17),
  stars: (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.045 : 0.11, a = i * Math.PI / 5; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); } const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }); g.rotateX(-Math.PI / 2); return g; })(),
  berries: (() => { const g = new THREE.SphereGeometry(0.1, 12, 10); g.scale(1, 1.25, 1); return g; })(),
};
const AM = { beads: glossy('#1d1b2f', { roughness: 0.1 }), cubes: new THREE.MeshPhysicalMaterial({ color: '#ff9ed2', roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 1 }), stars: glossy('#ffd23f', { metalness: 0.5, roughness: 0.2 }), berries: glossy('#ff2d55', { roughness: 0.3 }) };
const CUBE_COLS = ['#ff9ed2', '#b9a7ff', '#9be15d', '#7fd3ff', '#ffe066'];
const MAXA = 160, addMesh = {}, addItems = { beads: [], cubes: [], stars: [], berries: [] };
for (const k of ADDINS) { const m = new THREE.InstancedMesh(AG[k], AM[k], MAXA); m.count = 0; m.castShadow = true; m.frustumCulled = false; scene.add(m); addMesh[k] = m; if (k === 'cubes') for (let i = 0; i < MAXA; i++) m.setColorAt(i, new THREE.Color(CUBE_COLS[i % 5])); }
const dummy = new THREE.Object3D();

// tools
const dropper = new THREE.Group();
{ const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), glossy('#ff2d55')); bulb.scale.y = 1.3; bulb.position.y = 0.9;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 0.8, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, roughness: 0.1 })); tube.position.y = 0.4;
  dropper.add(bulb, tube); dropper.userData.bulb = bulb; dropper.traverse(o => o.castShadow = true); }
scene.add(dropper); dropper.visible = false;
const jug = new THREE.Group();
{ const body = new THREE.Mesh(rounded(0.7, 1.0, 0.7, 0.2), new THREE.MeshPhysicalMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.75, roughness: 0.05, clearcoat: 1 }));
  const lab = new THREE.Mesh(rounded(0.72, 0.36, 0.5, 0.05), mat('#ffffff')); lab.position.set(0, -0.05, 0.12);
  const capJ = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 14), glossy('#13a58a')); capJ.position.y = 0.6;
  jug.add(body, lab, capJ); jug.traverse(o => o.castShadow = true); }
scene.add(jug); jug.visible = false;
const drops = [];

// ------------------------------------------------------------------ level
let L;
function genLevel(lv) {
  const r = rng((D.seed || 0) + lv * 7919 + 55), fk = F.k();
  const pool = lv <= 2 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5];
  const nTypes = lv === 1 ? 1 : lv <= 3 ? 2 : (r() < 0.6 ? 2 : 3), counts = new Array(DYES.length).fill(0), used = [];
  while (used.length < nTypes) { const c = pool[Math.floor(r() * pool.length)]; if (!used.includes(c)) used.push(c); }
  used.forEach(c => counts[c] = c === 5 ? 1 : 1 + Math.floor(r() * (lv <= 2 ? 2 : 3)));
  if (lv === 1) counts[used[0]] = 2;
  const opts = pool.slice(0, Math.min(DYES.length, 4 + Math.floor(lv / 3)));
  used.forEach(c => { if (!opts.includes(c)) opts.push(c); }); if (opts.length > 5) opts.splice(0, opts.length - 5, ...[]);
  const fixedOpts = [...new Set([...used, ...opts])].slice(0, 5).sort((a, b) => a - b);
  const add = ADDINS[Math.floor(r() * ADDINS.length)], addOpts = [add]; while (addOpts.length < Math.min(4, 2 + Math.floor(lv / 2))) { const a = ADDINS[Math.floor(r() * 4)]; if (!addOpts.includes(a)) addOpts.push(a); }
  addOpts.sort(() => r() - 0.5);
  return { counts, used, target: mixColor(counts), opts: fixedOpts, act: 0.38 + r() * 0.34, zone: clamp(0.11 / fk, 0.06, 0.14), add, addOpts, need: 3 + Math.floor(r() * 3),
    name: NAMES1[Math.floor(r() * NAMES1.length)] + ' ' + NAMES2[Math.floor(r() * NAMES2.length)], line: LINES[Math.floor(r() * LINES.length)], hideDyes: lv >= 5,
    thr: clamp((0.7 + (lv - 1) * 0.012) * fk, 0.6, 0.92) };
}
function addIcon(c, k, x, y, s) {
  c.save(); c.translate(x, y);
  if (k === 'beads') { c.fillStyle = '#1d1b2f'; for (const [a, b] of [[-0.2, 0.1], [0.2, 0.12], [0, -0.18]]) { c.beginPath(); c.arc(a * s, b * s, s * 0.15, 0, 7); c.fill(); } c.fillStyle = '#fff'; c.beginPath(); c.arc(-s * 0.05, -s * 0.23, s * 0.04, 0, 7); c.fill(); }
  else if (k === 'cubes') { [['#ff9ed2', -0.18, 0.1], ['#b9a7ff', 0.18, 0.05], ['#9be15d', 0, -0.2]].forEach(([cc, a, b]) => { c.fillStyle = cc; c.fillRect((a - 0.13) * s, (b - 0.13) * s, s * 0.26, s * 0.26); }); }
  else if (k === 'stars') { c.fillStyle = '#ffc61a'; c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? s * 0.15 : s * 0.36, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
  else { c.fillStyle = '#ff2d55'; c.beginPath(); c.ellipse(0, s * 0.05, s * 0.26, s * 0.32, 0, 0, 7); c.fill(); c.fillStyle = '#3ab795'; c.beginPath(); c.ellipse(0, -s * 0.27, s * 0.2, s * 0.08, 0, 0, 7); c.fill(); c.fillStyle = '#ffe066'; for (let i = 0; i < 5; i++) { c.fillRect((Math.sin(i * 2.1) * 0.14) * s, (Math.cos(i * 1.7) * 0.15 + 0.05) * s, 2, 3); } }
  c.restore();
}
function drawTarget() {
  const c = $('tgtc').getContext('2d'), Wd = 184, Ht = 248; c.clearRect(0, 0, Wd, Ht);
  const cx = Wd / 2, cy = 112, hex = hexOf(L.target);
  c.fillStyle = '#eef2f2'; c.beginPath(); c.ellipse(cx, cy + 8, 78, 70, 0, 0, 7); c.fill();
  c.fillStyle = hex; c.beginPath(); c.ellipse(cx, cy, 66, 58, 0, 0, 7); c.fill();
  const g = c.createRadialGradient(cx - 22, cy - 22, 4, cx, cy, 70); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, 66, 58, 0, 0, 7); c.fill();
  const r = rng(9); for (let i = 0; i < 7; i++) addIcon(c, L.add, cx + (r() - 0.5) * 90, cy + (r() - 0.5) * 70, 26);
  c.fillStyle = '#3a6b62'; c.font = '800 19px "Baloo 2", system-ui'; c.textAlign = 'center'; c.fillText(L.name.toUpperCase(), cx, 200);
  if (!L.hideDyes) L.used.forEach((d, i) => { c.fillStyle = DYES[d][0]; c.beginPath(); c.arc(cx + (i - (L.used.length - 1) / 2) * 26, 226, 9, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); });
  else { c.fillStyle = '#3a6b62'; c.font = '800 15px "Baloo 2", system-ui'; c.fillText('secret recipe', cx, 230); }
  $('tgtName').textContent = 'RECIPE';
}

// ------------------------------------------------------------------ UI rows
const show = (id, on) => $(id).classList.toggle('off', !on);
const dropSVG = (cc) => `<svg viewBox="0 0 52 72"><path d="M26 6 C 34 22 46 34 46 48 A 20 20 0 0 1 6 48 C 6 34 18 22 26 6 Z" fill="${cc}" stroke="#fff" stroke-width="4"/><ellipse cx="18" cy="44" rx="4" ry="8" fill="rgba(255,255,255,.55)"/></svg>`;
function buildRows() {
  $('dyes').innerHTML = L.opts.map(c => `<button class="drop" data-c="${c}">${dropSVG(DYES[c][0])}</button>`).join('');
  $('dyes').querySelectorAll('.drop').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); addDrop(+b.dataset.c); }));
  $('addins').innerHTML = L.addOpts.map(k => { const c = document.createElement('canvas'); c.width = c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#e8fbf6'; x.beginPath(); x.arc(40, 40, 36, 0, 7); x.fill(); addIcon(x, k, 40, 42, 60); return `<button class="opt" data-k="${k}"><svg viewBox="0 0 80 80"><image href="${c.toDataURL()}" width="80" height="80"/></svg>${k.toUpperCase()}</button>`; }).join('');
  $('addins').querySelectorAll('.opt').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selAdd = b.dataset.k; $('addins').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === b)); sfx.pick(3); buzz(8); }));
}
$('done').addEventListener('pointerdown', (e) => { e.stopPropagation(); doneStep(); });

// ------------------------------------------------------------------ state
let state = 'ready', phase = 'mix', phT = 0, counts = [], stir = 0, pouring = false, selAdd = null, handfuls = {}, squishes = 0, parts = {}, finished = false, beatenShown = false;
function setAsk(t) { $('ask').textContent = t; show('ask', true); }
function curColor() { return mixColor(counts); }
function colorScore() { return clamp(1 - cdist(curColor(), L.target) / 0.32, 0, 1); }
function updMix() { $('mixSw').style.background = hexOf(curColor()); $('mixPct').textContent = Math.round(colorScore() * 100) + '%'; }
function paintGlue() {
  sx.fillStyle = '#f6f6f2'; sx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { sx.strokeStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.4})`; sx.lineWidth = 3 + Math.random() * 6; sx.beginPath(); const a = Math.random() * 6.28, r0 = 40 + Math.random() * 200; sx.arc(256, 256, r0, a, a + 0.6 + Math.random()); sx.stroke(); }
  slTex.needsUpdate = true;
}
function buildLevel() {
  L = genLevel(level); phase = 'mix'; phT = 0; counts = new Array(DYES.length).fill(0); stir = 0; pouring = false; selAdd = null; handfuls = {}; squishes = 0; parts = {}; finished = false;
  visc = 0; dome = 0; domeGoal = 0; Hd.fill(0); Hv.fill(0); paintGlue(); slimeMat.color.set('#ffffff'); slimeMat.roughness = 0.08;
  for (const k of ADDINS) { addItems[k] = []; addMesh[k].count = 0; }
  ui.levels(level); ui.progress(0); drawTarget(); buildRows(); updMix();
  $('bub').textContent = L.line;
  $('banner').classList.remove('on', 'bad');
  ['dyes', 'addins', 'done', 'gauge', 'mix'].forEach(id => show(id, false));
  dropper.visible = jug.visible = false;
  $('zone').style.left = (L.act - L.zone) * 100 + '%'; $('zone').style.width = L.zone * 200 + '%'; $('gfill').style.width = '0%';
  if (state === 'play') beginMix(); else show('ask', false);
}
function beginMix() { phase = 'mix'; setAsk('Drip the dyes, then stir'); show('dyes', true); show('mix', true); dropper.visible = true; }
function addDrop(c) {
  if (state !== 'play' || phase !== 'mix') return;
  counts[c]++; dropper.userData.bulb.material.color.set(DYES[c][0]); dropper.userData.squeeze = 1;
  const a = Math.random() * 6.28, d = Math.random() * 0.9;
  drops.push({ c, x: Math.cos(a) * d, z: Math.sin(a) * d, y: 2.2, vy: 0 });
  tone(700, 0.06, 'sine', 0.08, 1.5); buzz(8); stir = Math.min(stir, 0.6);
  updMix(); $('done').classList.remove('go');
}
function landDrop(dr) {
  const [u, v] = uvOf(dr.x, dr.z), [r, g, b] = rgb(DYES[dr.c][0]).map(x => Math.round(x * 255));
  const gr = sx.createRadialGradient(u, v, 0, u, v, 70); gr.addColorStop(0, `rgba(${r},${g},${b},.95)`); gr.addColorStop(0.6, `rgba(${r},${g},${b},.7)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  sx.fillStyle = gr; sx.beginPath(); sx.arc(u, v, 70, 0, 7); sx.fill(); slTex.needsUpdate = true;
  impulse(dr.x, dr.z, -0.25, 0.25); squish(0.12, 1200, 0.12); pop();
}
function doStir(amount, x, z) {
  if (phase !== 'mix' || !counts.some(n => n)) return;
  stir = Math.min(1, stir + amount);
  // swirl the canvas around the bowl centre, then fade toward the true mixed colour
  sx.save(); sx.globalAlpha = 0.5; sx.translate(256, 256); sx.rotate(0.05); sx.translate(-256, -256); sx.drawImage(slC, 0, 0); sx.restore();
  sx.globalAlpha = 0.03 + stir * 0.08; sx.fillStyle = hexOf(curColor()); sx.fillRect(0, 0, 512, 512); sx.globalAlpha = 1;
  if (stir >= 1) { sx.fillStyle = hexOf(curColor()); sx.globalAlpha = 0.35; sx.fillRect(0, 0, 512, 512); sx.globalAlpha = 1; }
  slTex.needsUpdate = true;
  if (x !== undefined) impulse(x, z, -0.03, 0.35);
  if (Math.random() < 0.25) squish(0.06, 500 + Math.random() * 300, 0.15);
  ui.progress(0.3 * stir); $('done').classList.toggle('go', stir >= 1);
  if (stir >= 1 && !parts.stirPop) { parts.stirPop = 1; ui.pop('MIXED!', '#fff', 32, 30); note(74, 0.3); buzz(12); }
}
function finalizeColour() {
  const c = hexOf(curColor()); sx.fillStyle = c; sx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) { sx.strokeStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.12})`; sx.lineWidth = 4 + Math.random() * 14; sx.beginPath(); const a = Math.random() * 6.28; sx.arc(256, 256, 30 + Math.random() * 220, a, a + 0.8 + Math.random() * 1.5); sx.stroke(); }
  for (let i = 0; i < 260; i++) { sx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`; sx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5); }
  slTex.needsUpdate = true;
}
function beginActivator() {
  parts.color = colorScore(); finalizeColour(); phase = 'act'; dropper.visible = false; jug.visible = true; show('dyes', false); show('mix', false); show('done', false);
  show('gauge', true); setAsk('Hold to pour · stop in the green');
  ui.pop(parts.color > 0.9 ? 'SPOT ON!' : parts.color > 0.6 ? 'CLOSE!' : 'HMM, OFF-COLOUR', '#fff', 30, 30);
}
let lastZone = false;
function pourStep(dt) {
  visc = Math.min(1, visc + 0.0055 * dt); dome = 0.15 + visc * 0.5;
  $('gfill').style.width = visc * 100 + '%';
  if (Math.random() < 0.5) burst(scene, V(0.35 + (Math.random() - 0.5) * 0.1, 1.2, -0.1), ['#bff4ff', '#ffffff'], 1, { shape: 'sphere', speed: 0.005, up: -0.05, size: 0.4, gravity: 0.01, life: 0.4 });
  if (Math.random() < 0.15) squish(0.07, 300, 0.2);
  const inZone = Math.abs(visc - L.act) <= L.zone; if (inZone && !lastZone) { tone(880, 0.1, 'triangle', 0.1, 1); buzz(10); } lastZone = inZone;
  impulse(0.35, -0.1, -0.02, 0.3);
  ui.progress(0.3 + 0.3 * Math.min(1, visc / L.act));
  slimeMat.roughness = 0.08 + visc * 0.2;
}
function endPour() {
  if (phase !== 'act' || visc <= 0.02) return;
  parts.act = clamp(1 - Math.abs(visc - L.act) / (L.zone * 2.6), 0, 1);
  const lab = Math.abs(visc - L.act) <= L.zone ? 'PERFECT STRETCH!' : visc > L.act ? 'TOO RUBBERY!' : 'STILL STICKY!';
  ui.pop(lab, parts.act > 0.6 ? '#fff' : '#ffe066', 30, 30); note(parts.act > 0.6 ? 79 : 60, 0.3);
  phase = 'add'; jug.visible = false; show('gauge', false); setAsk('Pick an add-in · tap to sprinkle'); show('addins', true);
  // the glue pulls together into a slime blob
  for (let p = 0; p < N * N; p++) Hv[p] += 0.02 * (1 - RR[p]);
}
function sprinkle(x, z) {
  if (phase !== 'add') return;
  if (!selAdd) { ui.pop('Pick an add-in first!', '#fff', 26, 30); return; }
  handfuls[selAdd] = (handfuls[selAdd] || 0) + 1;
  for (let i = 0; i < 13; i++) { const a = Math.random() * 6.28, d = Math.random() * 0.55, px = clamp(x + Math.cos(a) * d, -1.5, 1.5), pz = clamp(z + Math.sin(a) * d, -1.5, 1.5);
    if (addItems[selAdd].length < MAXA) addItems[selAdd].push({ x: px, z: pz, y: 2 + Math.random(), vy: 0, r: Math.random() * 6, s: 0.85 + Math.random() * 0.4, landed: false }); }
  tone(1300 + Math.random() * 400, 0.05, 'triangle', 0.07, 1.2); buzz(8);
  const tot = handfuls[selAdd]; ui.progress(0.6 + 0.2 * Math.min(1, (handfuls[L.add] || 0) / L.need));
  show('done', true); $('done').classList.toggle('go', (handfuls[L.add] || 0) >= L.need);
  if (selAdd === L.add && tot === L.need) { ui.pop('JUST RIGHT!', '#fff', 30, 30); note(76, 0.25); }
}
function beginPlay() {
  const right = handfuls[L.add] || 0, wrong = Object.keys(handfuls).reduce((a, k) => a + (k === L.add ? 0 : handfuls[k]), 0);
  parts.add = clamp((right ? 0.4 : 0) + 0.6 * (1 - Math.abs(right - L.need) / L.need) - wrong * 0.12, 0, 1);
  phase = 'play'; phT = 0; show('addins', false); show('done', false); setAsk('Squish it! Poke · stretch · knead'); squishes = 0;
}
function poke(x, z, strength = 1) {
  if (phase !== 'play') return;
  impulse(x, z, -0.32 * strength, 0.38); squish(0.18, 450 + Math.random() * 500, 0.22);
  if (Math.random() < 0.35) { pop(); burst(scene, V(x, heightAt(x, z) + 0.1, z), ['#ffffff', hexOf(curColor())], 6, { shape: 'sphere', speed: 0.04, up: 0.05, size: 0.35 }); }
  for (const k of ADDINS) for (const it of addItems[k]) { const d = Math.hypot(it.x - x, it.z - z); if (d < 0.6 && d > 0.001) { it.x += (it.x - x) / d * 0.06; it.z += (it.z - z) / d * 0.06; } }
  squishes += 0.07 * strength; ui.progress(0.8 + 0.2 * Math.min(1, squishes)); buzz(6);
  if (squishes >= 1 && !finished) { phase = 'reveal'; phT = 0; show('ask', false); ui.pop('SO SATISFYING!', '#fff', 32, 28); }
}
function finish() {
  if (finished) return; finished = true;
  const match = 0.4 * parts.color + 0.25 * parts.act + 0.35 * parts.add;
  const pct = Math.round(match * 100), ok = match >= L.thr, stars = match >= 0.93 ? 3 : match >= 0.83 ? 2 : ok ? 1 : 0;
  $('stars').innerHTML = '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i>';
  $('pct').textContent = ok ? `${pct}% MATCH` : `${pct}% · NEED ${Math.round(L.thr * 100)}%`;
  $('banner').classList.toggle('bad', !ok); $('banner').classList.add('on'); ui.flash(0.45);
  if (ok) {
    state = 'won'; F.level(true); score += pct; ST.set('score', score); best = Math.max(best, score); ST.set('best', best);
    $('bub').textContent = stars === 3 ? '“Lab-grade goo. Chef\'s kiss.”' : '“Squishy! I\'ll take it.”';
    sfx.win(); buzz([20, 40, 20]); confetti(scene, V(0, 2.5, 0), 80); setTimeout(() => confetti(scene, V(0.5, 2.5, 0), 60), 250);
    if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, V(0, 2.5, 0), 50); }, 300); }
    D.won(score); ui.win(level, stars === 3 ? `${L.name}, nailed! · ${score} pts` : `${pct}% match · ${score} pts`);
  } else {
    state = 'lost'; F.level(false, Math.min(1, match / L.thr)); sfx.fail(); buzz([40, 30, 60]);
    $('bub').textContent = '“That\'s not slime, that\'s soup.”';
    ui.lose('NOT THE RECIPE!', `${pct}% match · need ${Math.round(L.thr * 100)}%`);
  }
}
function doneStep() {
  if (state !== 'play') return;
  if (phase === 'mix' && stir >= 1) beginActivator();
  else if (phase === 'add') beginPlay();
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; beginMix(); sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else { state = 'play'; buildLevel(); }
});

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(V(0, 1, 0), -0.1), hit = V();
let down = false, held = null;
function ground(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
input({
  onDown: (e) => {
    if (e.target.closest && e.target.closest('button')) return; if (state !== 'play') return;
    down = true; const g = ground(e); held = g;
    if (phase === 'act') pouring = true;
    if (phase === 'add' && g) sprinkle(g.x, g.z);
    if (phase === 'play' && g) poke(g.x, g.z);
  },
  onMove: (dx, dy, e) => {
    if (!down || state !== 'play') return; const g = ground(e); if (!g) return;
    if (phase === 'mix') doStir(Math.hypot(dx, dy) * 0.0016, g.x, g.z);
    if (phase === 'play') { impulse(g.x, g.z, -0.05, 0.42); if (held) { for (const k of ADDINS) for (const it of addItems[k]) { const d = Math.hypot(it.x - g.x, it.z - g.z); if (d < 0.7) { it.x += (g.x - held.x) * 0.5 * (1 - d / 0.7); it.z += (g.z - held.z) * 0.5 * (1 - d / 0.7); } } }
      squishes += Math.hypot(dx, dy) * 0.0007; if (Math.random() < 0.2) squish(0.08, 300 + Math.random() * 200, 0.25); ui.progress(0.8 + 0.2 * Math.min(1, squishes)); if (squishes >= 1 && phase === 'play') poke(g.x, g.z, 0.01); }
    held = g;
  },
  onUp: () => { down = false; held = null; if (pouring) { pouring = false; endPour(); } },
});

// ------------------------------------------------------------------ loop
const camPos = V(0, 12.2, 4.6), camLook = V(0, 0, 0.25), cp = V(), cl = V();
let botPour = false, frame = 0;
loop((dt, t) => {
  frame += dt; phT += dt / 60;
  if ((pouring || botPour) && phase === 'act') pourStep(dt);
  stepSlime(Math.min(dt, 1.5));
  // falling dye drops
  for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy -= 0.01 * dt; d.y += d.vy * dt; if (d.y < 0) { landDrop(d); drops.splice(i, 1); } }
  // add-ins fall then ride on the surface
  for (const k of ADDINS) {
    const m = addMesh[k], arr = addItems[k]; let n = 0;
    for (const it of arr) {
      const r = Math.hypot(it.x, it.z); if (r > SR * 0.9) { it.x *= SR * 0.9 / r; it.z *= SR * 0.9 / r; }
      const hy = heightAt(it.x, it.z) + 0.07;
      if (!it.landed) { it.vy -= 0.008 * dt; it.y += it.vy * dt; if (it.y <= hy) { it.landed = true; impulse(it.x, it.z, -0.04, 0.2); } }
      else it.y += (hy - it.y) * 0.4 * dt;
      dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(k === 'berries' ? 1.2 : it.r * 0.3, it.r, 0); dummy.scale.setScalar(it.s); dummy.updateMatrix(); m.setMatrixAt(n++, dummy.matrix);
    }
    m.count = n; m.instanceMatrix.needsUpdate = true;
  }
  // tools
  if (dropper.visible) { dropper.userData.squeeze = Math.max(0, (dropper.userData.squeeze || 0) - 0.08 * dt); const sq = dropper.userData.squeeze; dropper.position.set(0.9 + Math.sin(t) * 0.1, 1.6, -0.6); dropper.rotation.z = -0.3; dropper.userData.bulb.scale.set(1 + sq * 0.25, 1.3 - sq * 0.35, 1 + sq * 0.25); }
  if (jug.visible) { const p = pouring || botPour; jug.position.lerp(V(1.0, 1.75, -0.2), 0.2 * dt); jug.rotation.z += ((p ? 1.9 : 0.4) - jug.rotation.z) * 0.15 * dt; }
  if (phase === 'reveal') {
    if (Math.random() < 0.3) burst(scene, V((Math.random() - 0.5) * 2.5, 0.6, (Math.random() - 0.5) * 2.5), ['#ffffff', hexOf(curColor())], 2, { shape: 'sphere', speed: 0.03, up: 0.06, size: 0.4 });
    if (phT > 0.9) finish();
  }
  // camera: bowl view while making, close-up while squishing
  if (phase === 'play' || phase === 'reveal') { cp.set(0, 4.2, 1.3); cl.set(0, 0, 0.15); } else { cp.set(0, 12.2, 4.6); cl.set(0, 0, 0.6); }
  camPos.lerp(cp, 0.05 * dt); camLook.lerp(cl, 0.06 * dt); camera.position.copy(camPos); camera.lookAt(camLook);
});

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get phase() { return phase; },
  bot() {
    if (state !== 'play') { botPour = false; return; }
    if (phase === 'mix') {
      const need = L.counts.findIndex((n, i) => counts[i] < n);
      if (need >= 0 && L.opts.includes(need)) return addDrop(need);
      if (drops.length) return;
      if (stir < 1) { for (let k = 0; k < 4; k++) doStir(0.09, Math.cos(frame * 0.2 + k) * 0.8, Math.sin(frame * 0.2 + k) * 0.8); return; }
      return doneStep();
    }
    if (phase === 'act') { if (visc < L.act - 0.012) { botPour = true; } else { botPour = false; endPour(); } return; }
    if (phase === 'add') {
      if (selAdd !== L.add) { const b = $('addins').querySelector(`[data-k="${L.add}"]`); b && b.dispatchEvent(new PointerEvent('pointerdown')); return; }
      if ((handfuls[L.add] || 0) < L.need) { const a = Math.random() * 6.28; return sprinkle(Math.cos(a) * 0.8, Math.sin(a) * 0.8); }
      return doneStep();
    }
    if (phase === 'play') { const a = Math.random() * 6.28, d = Math.random() * 1.3; poke(Math.cos(a) * d, Math.sin(a) * d, 1.4); }
  },
};

buildLevel();
ui.start();

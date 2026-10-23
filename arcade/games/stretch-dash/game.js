// Stretch Dash — original game. Steer a jelly runner through gates that make it taller, shorter, wider or thinner;
// beams and narrow gaps slice off whatever doesn't fit; spend your size climbing the multiplier stairs at the end.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
const WB = board({ game: 'stretch-dash', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.3 }, mode: 'sum', corner: 'bl' });
const ST = store('stretchdash');
const F = flow('stretchdash'); let fk = 1;
let level = ST.get('level', 1), best = ST.get('best', 0), total = ST.get('gems', 0);
const { scene, camera, followLight } = createStage({ fov: 52, shadowSize: 12 });
const ui = createUI({ title: 'STRETCH<br>DASH', hint: 'Tap left or right to steer', hand: '👆', score: false });
const nextCard = w => (l, x) => { ui.els.win.querySelector('.hint').textContent = 'Level ' + (l + 1) + ' ▶'; w(l, x); }; ui.win = nextCard(ui.win);   // one tap → next level
document.body.style.setProperty('--bg1', '#22b4ff'); document.body.style.setProperty('--bg2', '#bfeaff'); document.body.style.setProperty('--ui', '#ff7a1a');
document.title = 'Stretch Dash';
const $ = id => document.getElementById(id);

const TW = 6.4, SPEED = 9.5, BASE_H = 1.8, MIN_H = 0.32, MIN_W = 0.4;
const JELLY = glossy('#ff8a1a', { roughness: 0.18, emissive: '#ff5a00', emissiveIntensity: 0.12 });

// ---------------------------------------------------------------- jelly runner (stretched as a whole: scale.y = height, scale.xz = width)
function makeRunner() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, JELLY); m.position.set(x, y, z); m.castShadow = true; inner.add(m); return m; };
  const piv = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); inner.add(p); return p; };
  const torso = add(new THREE.CapsuleGeometry(0.27, 0.42, 6, 16), 0, 1.08, 0); torso.scale.set(1, 1, 0.85);
  const head = add(new THREE.SphereGeometry(0.21, 20, 16), 0, 1.6, 0);
  const limb = (p, r, len) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), JELLY); m.position.y = -len / 2 - 0.02; m.castShadow = true; p.add(m); return m; };
  const legL = piv(-0.13, 0.72), legR = piv(0.13, 0.72), armL = piv(-0.36, 1.32), armR = piv(0.36, 1.32);
  limb(legL, 0.12, 0.5); limb(legR, 0.12, 0.5); limb(armL, 0.095, 0.48); limb(armR, 0.095, 0.48);
  armL.rotation.z = -0.25; armR.rotation.z = 0.25;
  Object.assign(g, { inner, legL, legR, armL, armR, head, torso });
  return g;
}

// ---------------------------------------------------------------- textures
function labelTex(top, big, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = color; x.globalAlpha = 0.55; x.fillRect(0, 0, 256, 256); x.globalAlpha = 1;
  x.fillStyle = color; x.fillRect(0, 0, 256, 54);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '800 38px "Baloo 2", system-ui, sans-serif'; x.fillText(top, 128, 30);
  x.font = '800 92px "Baloo 2", system-ui, sans-serif'; x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.18)'; x.strokeText(big, 128, 150); x.fillText(big, 128, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hazardTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#ffd21f'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#23232e'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 20, 0); x.lineTo(i * 16 + 12, 0); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; })();
const trackTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#f4fbff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#dff1fb'; x.fillRect(0, 0, 128, 40); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const STEP_COLS = ['#ff4d6d', '#ff8c42', '#ffd23f', '#9ef01a', '#3ab795', '#00c2ff', '#3a86ff', '#7b5cff', '#c77dff', '#ff5d8f', '#ff4d6d', '#ff8c42'];

// ---------------------------------------------------------------- level
let camUp = 0, world, rows, gemsArr, gemMesh, stairs, stairZ, finZ, runner, state = 'ready', P, R, gems = 0, camD = 8, chunks = [], climbStep = -1, endT = 0, mult = 1;
function buildLevel() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  R = rng(level * 613 + 5); fk = F.k();
  rows = []; gems = 0; chunks = []; climbStep = -1; endT = 0; mult = 1;
  const nRows = Math.min(14, 5 + level);
  let z = -16;
  for (let i = 0; i < nRows; i++) {
    const kind = i % 2 === 0 ? 'gates' : (R() < 0.5 ? 'bar' : 'gap');
    const row = { kind, z, done: false };
    if (kind === 'gates') {
      const mag = () => [20, 30, 40, 50, 60][Math.floor(R() * Math.min(5, 2 + level))];
      const types = [['Taller', 'h', 1], ['Wider', 'w', 1], ['Shorter', 'h', -1], ['Thinner', 'w', -1]];
      const good = types[Math.floor(R() * 2)], bad = types[2 + Math.floor(R() * 2)];
      let pair = R() < 0.75 ? [good, bad] : (R() < 0.5 ? [types[0], types[1]] : [bad, types[2 + (bad === types[2] ? 1 : 0)]]);
      if (R() < 0.5) pair = [pair[1], pair[0]];
      row.gates = pair.map(([label, axis, sign], j) => {
        const v = mag(), gx = j ? TW / 4 : -TW / 4, col = sign > 0 ? '#1e90ff' : '#ff3b4e';
        const m = new THREE.Mesh(new THREE.BoxGeometry(TW / 2 - 0.25, 2.6, 0.12), new THREE.MeshStandardMaterial({ map: labelTex(label, (sign > 0 ? '+' : '-') + v, col), transparent: true, opacity: 0.92, roughness: 0.3 }));
        m.position.set(gx, 1.3, z); world.add(m);
        return { x: gx, axis, d: sign * v / 100, m, label };
      });
    } else if (kind === 'bar') {
      row.h = [1.25, 1.6, 2.0, 2.6, 3.2][Math.floor(R() * 5)] * (level < 3 ? 1.15 : 1);
      const bt = hazardTex.clone(); bt.needsUpdate = true; bt.repeat.set(3, 1); const bar = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.6, 0.32, 0.32), mat('#ffffff', { map: bt }));
      bar.position.set(0, row.h + 0.16, z); bar.castShadow = true; world.add(bar);
      for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, row.h + 0.32, 0.32), mat('#23232e')); post.position.set(sx * (TW / 2 + 0.3), (row.h + 0.32) / 2, z); post.castShadow = true; world.add(post); }
      row.m = bar;
    } else {
      row.gw = clamp((1.6 - level * 0.05 + R() * 0.8) / fk, 0.8, 2.6); row.gx = (R() - 0.5) * (TW - row.gw - 0.6);
      row.blocks = [];
      for (const sd of [-1, 1]) {
        const x0 = sd < 0 ? -TW / 2 : row.gx + row.gw / 2, x1 = sd < 0 ? row.gx - row.gw / 2 : TW / 2, w = x1 - x0;
        if (w < 0.05) continue;
        const ht = hazardTex.clone(); ht.needsUpdate = true; ht.repeat.set(Math.max(0.5, w / 3.5), 1); const b = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 0.6), glossy('#ffffff', { map: ht })); b.position.set((x0 + x1) / 2, 1.1, z); b.castShadow = true; world.add(b); row.blocks.push({ m: b, x0, x1 });
      }
    }
    rows.push(row); z -= 13;
  }
  finZ = z + 4;
  // track
  const len = -finZ + 40;
  const tt = trackTex.clone(); tt.needsUpdate = true; tt.repeat.set(1, len / 4);
  const track = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.6, len), mat('#ffffff', { map: tt, roughness: 0.5 })); track.position.set(0, -0.3, -len / 2 + 14); track.receiveShadow = true; world.add(track);
  for (const sx of [-1, 1]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, len), mat('#c8e9ff')); edge.position.set(sx * (TW / 2 + 0.12), -0.22, track.position.z); world.add(edge); }
  // gems
  gemsArr = [];
  for (let i = 0; i < nRows; i++) { const zz = rows[i].z + 6.5, lane = (R() - 0.5) * (TW - 1.4); for (let k = 0; k < 3; k++) gemsArr.push({ x: lane, z: zz + k * 1.2, y: 0.7, got: false }); }
  gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.28, 0), glossy('#ff2bd6', { emissive: '#b0009a', emissiveIntensity: 0.35, flatShading: true }), gemsArr.length); gemMesh.castShadow = true; world.add(gemMesh);
  // multiplier stairs
  stairs = []; stairZ = finZ - 3;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(TW, 1.4), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#23232e' : '#fff'; x.fillRect(i * 4, j * 4, 4, 4); } const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
  fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.01, finZ); world.add(fl);
  for (let i = 0; i < 12; i++) {
    const m = (1 + i * 0.2).toFixed(1), y = (i + 1) * 0.45, sz = stairZ - i * 1.3;
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = STEP_COLS[i]; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = '800 44px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('x' + m, 128, 34);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const side = mat(STEP_COLS[i]), front = mat('#ffffff', { map: tx });
    const step = new THREE.Mesh(new THREE.BoxGeometry(TW, y, 1.3), [side, side, side, side, front, side]); step.position.set(0, y / 2, sz - 0.65); step.receiveShadow = true; step.castShadow = true; world.add(step);
    stairs.push({ y, z: sz - 0.65, m: +m, mesh: step });
  }
  // runner
  runner = makeRunner(); world.add(runner);
  P = { x: 0, z: 0, tx: 0, H: 1, W: 1, dH: 1, dW: 1, vH: 0, vW: 0, ph: 0, y: 0 };
  ui.levels(level); ui.progress(0); setHud();
  camD = 8;
}
function setHud() { $('gems').textContent = '💎 ' + gems; $('size').innerHTML = `↕ ${Math.round(P.H * 100)}<br>↔ ${Math.round(P.W * 100)}`; }

// ---------------------------------------------------------------- input
let dragging = false, botX = null;
input({
  onDown() { if (state === 'play') { dragging = true; botX = null; } },
  onMove(dx) { if (state === 'play' && dragging) P.tx = clamp(P.tx + dx * 0.022, -TW / 2 + 0.4, TW / 2 - 0.4); },
  onUp() { dragging = false; },
  onTap(e) { if (state === 'play') { botX = null; P.tx = clamp(P.tx + (e.clientX < innerWidth / 2 ? -1 : 1) * TW / 4, -TW / 2 + 0.4, TW / 2 - 0.4); } },   // tap a side = hop one gate that way
});
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; buildLevel(); }
});

// ---------------------------------------------------------------- events
function chop(kind, amount) {
  // a jelly chunk flies off + splash
  const piece = new THREE.Mesh(new THREE.CapsuleGeometry(0.22 * P.W, Math.max(0.1, amount * BASE_H * 0.8), 5, 10), JELLY);
  if (kind === 'h') piece.position.set(P.x, P.H * BASE_H - amount * BASE_H / 2, P.z);
  else { piece.position.set(P.x + (Math.random() < 0.5 ? -1 : 1) * P.W * 0.3, BASE_H * P.H * 0.55, P.z); piece.rotation.z = 1.4; }
  piece.castShadow = true; world.add(piece);
  chunks.push({ m: piece, v: new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.12, 0.16), s: (Math.random() - 0.5) * 0.3, life: 1 });
  burst(world, piece.position, ['#ff8a1a', '#ffb347', '#ff5a00'], 16, { speed: 0.12, up: 0.1, size: 0.9, shape: 'sphere' });
  sfx.smash(); buzz([25, 20, 25]); ui.flash(0.25);
}
function lose(t) { state = 'lost'; F.level(false, rows.filter(r => r.done).length / rows.length); sfx.fail(); buzz([40, 30, 60]); ui.lose(t, `${gems} 💎 collected`); }
function win() {
  state = 'won'; F.level(true); WB.submit(1); const pts = Math.round(gems * mult); total += pts; ST.set('gems', total); best = Math.max(best, pts); ST.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1);
  confetti(world, new THREE.Vector3(P.x, P.y + 3, P.z - 1), 110); setTimeout(() => confetti(world, new THREE.Vector3(P.x, P.y + 3, P.z - 1), 70), 300);
  ui.win(level, `x${mult.toFixed(1)}  ·  ${pts} 💎`);
}
const stepCost = () => 0.2;
function bodyMass() { return P.H * P.W; }

// ---------------------------------------------------------------- loop
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
loop((dt, t) => {
  if (!runner) return;
  const s = dt / 60;
  if (state === 'play') {
    if (climbStep < 0) {
      P.z -= SPEED * fk * s;
      if (botX !== null && !dragging) P.tx = botX;
      P.x = lerp(P.x, P.tx, 0.2 * dt);
      const halfW = 0.36 * P.W;
      for (const row of rows) {
        if (row.done || P.z > row.z) continue;
        row.done = true;
        if (row.kind === 'gates') {
          const g = row.gates.reduce((a, b) => Math.abs(b.x - P.x) < Math.abs(a.x - P.x) ? b : a);
          if (g.axis === 'h') P.H = Math.max(0.05, P.H + g.d); else P.W = Math.max(0.05, P.W + g.d);
          g.m.material.opacity = 0.25; g.m.scale.set(1.08, 1.08, 1);
          const good = g.d > 0;
          ui.pop((good ? '+' : '') + Math.round(g.d * 100) + ' ' + g.label.toUpperCase(), good ? '#ffffff' : '#ff3b4e', 34, 30);
          if (good) { note(72, 0.2, 0.14); setTimeout(() => note(79, 0.25, 0.14), 80); buzz(10); burst(world, new THREE.Vector3(P.x, BASE_H * P.H, P.z), ['#1e90ff', '#ffffff'], 12, { speed: 0.1, up: 0.08 }); }
          else { tone(300, 0.2, 'square', 0.08, 0.6); buzz([15, 10, 15]); }
          if (P.H < MIN_H || P.W < MIN_W) { P.H = Math.max(P.H, 0.05); return lose('TOO SMALL!'); }
        } else if (row.kind === 'bar') {
          const top = P.H * BASE_H;
          if (top > row.h) { const nh = (row.h - 0.06) / BASE_H, cut = P.H - nh; P.H = nh; chop('h', cut); ui.pop('SLICED!', '#ffd21f', 36, 30); if (P.H < MIN_H) return lose('SLICED TOO SHORT!'); }
          else { ui.pop('DUCKED!', '#fff', 30, 30); sfx.coin(); }
        } else {
          const l = row.gx - row.gw / 2, r = row.gx + row.gw / 2;
          if (P.x < l || P.x > r) {      // smashed into the wall
            P.H -= 0.35; chop('h', 0.35); for (const b of row.blocks) if (P.x >= b.x0 - 0.2 && P.x <= b.x1 + 0.2) { burst(world, b.m.position, ['#ffd21f', '#23232e'], 18, { speed: 0.15, up: 0.1, size: 1.2 }); b.m.visible = false; }
            ui.pop('CRASH! -35', '#ff3b4e', 36, 30); if (P.H < MIN_H) return lose('CRUSHED!');
          } else if (halfW * 2 > row.gw) { const nw = (row.gw * 0.92) / 0.72, cut = P.W - nw; P.W = nw; chop('w', cut * 0.5); ui.pop('SQUEEZED!', '#ffd21f', 34, 30); if (P.W < MIN_W) return lose('SQUEEZED FLAT!'); }
          else { ui.pop('PERFECT FIT!', '#fff', 30, 30); sfx.coin(); }
        }
        setHud();
      }
      for (const gm of gemsArr) if (!gm.got && Math.abs(gm.z - P.z) < 0.6 && Math.abs(gm.x - P.x) < 0.5 + 0.36 * P.W) { gm.got = true; gems++; sfx.coin(); buzz(4); setHud(); burst(world, new THREE.Vector3(gm.x, gm.y, gm.z), '#ff2bd6', 6, { speed: 0.06, up: 0.06, size: 0.5 }); }
      ui.progress(Math.min(0.9, P.z / finZ * 0.9));
      if (P.z < stairZ) { climbStep = 0; P.x = lerp(P.x, 0, 0.5); }
    } else {
      // stair climb: every step costs body mass
      const st = stairs[climbStep], tz = st.z;
      P.z = lerp(P.z, tz, 0.16 * dt); P.y = lerp(P.y, st.y, 0.2 * dt); P.x = lerp(P.x, 0, 0.1 * dt);
      if (Math.abs(P.z - tz) < 0.12) {
        const nextCost = stepCost();
        if (climbStep === 0 && !stairs[0].paid) {
          stairs[0].paid = true;
          if (bodyMass() - nextCost < MIN_H * 0.6) return lose('TOO SMALL TO CLIMB!');
          shrinkBy(nextCost); stepFx(0);
        }
        mult = stairs[climbStep].m;
        if (climbStep < stairs.length - 1 && bodyMass() - nextCost >= MIN_H * 0.6) { climbStep++; shrinkBy(nextCost); stepFx(climbStep); }
        else return win();
      }
      ui.progress(0.9 + climbStep / stairs.length * 0.1);
    }
  }
  // jelly spring on size changes
  for (const [k, d, v] of [['H', 'dH', 'vH'], ['W', 'dW', 'vW']]) { P[v] += (P[k] - P[d]) * 0.12 * dt; P[v] *= Math.pow(0.82, dt); P[d] += P[v] * dt; }
  const run = state === 'play' ? 1 : 0;
  P.ph += s * 11 * run;
  runner.position.set(P.x, P.y, P.z);
  runner.scale.set(P.dW, P.dH, P.dW);
  runner.rotation.y = Math.PI + (P.tx - P.x) * -0.25;
  const sw = Math.sin(P.ph);
  if (state === 'won') { endT += s; runner.armL.rotation.set(0, 0, -2.6 - Math.sin(endT * 10) * 0.3); runner.armR.rotation.set(0, 0, 2.6 + Math.sin(endT * 10) * 0.3); runner.inner.position.y = Math.abs(Math.sin(endT * 7)) * 0.25; runner.rotation.y = lerp(runner.rotation.y, 0, 0.05); runner.legL.rotation.x = runner.legR.rotation.x = 0; }
  else { runner.legL.rotation.x = sw * 0.9 * run; runner.legR.rotation.x = -sw * 0.9 * run; runner.armL.rotation.x = -sw * 0.8 * run; runner.armR.rotation.x = sw * 0.8 * run; runner.inner.position.y = Math.abs(Math.cos(P.ph)) * 0.06 * run; }
  // chopped chunks
  for (const c of chunks) { c.v.y -= 0.008 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.s * dt; c.m.rotation.z += c.s * 0.7 * dt; if (c.m.position.y < 0.2) { c.m.position.y = 0.2; c.v.set(c.v.x * 0.6, Math.abs(c.v.y) * 0.3, c.v.z * 0.6); } c.life -= 0.006 * dt; }
  // gems spin
  gemsArr.forEach((g, i) => { const sc = g.got ? 0 : 1; M.compose(V.set(g.x, g.y + Math.sin(t * 3 + i) * 0.1, g.z), Q.setFromEuler(E.set(0, t * 2 + i, 0)), S.setScalar(sc)); gemMesh.setMatrixAt(i, M); }); gemMesh.instanceMatrix.needsUpdate = true;
  // camera: behind and above, pulling back as the runner grows
  const tall = P.dH * BASE_H, wantD = 7.2 + Math.max(0, tall - 1.8) * 1.4 + Math.max(0, P.dW - 1) * 1.5;
  camD = lerp(camD, state === 'won' ? 8.5 : wantD, 0.05 * dt);
  const ang = state === 'won' ? endT * 0.4 : 0;
  const climb = climbStep >= 0 || state === 'won' ? 1 : 0; camUp = lerp(camUp, climb, 0.05 * dt);
  camera.position.set(P.x * 0.5 + Math.sin(ang) * camD, P.y + camD * 0.62 + tall * 0.3 + camUp * 3.2, P.z + Math.cos(ang) * camD + camUp * 1.5);
  camera.lookAt(P.x * 0.5, P.y + tall * 0.55 + camUp * 0.6, P.z - 3.5 + camUp * 1.5);
  followLight(V.set(P.x, P.y, P.z - 2));
});
function shrinkBy(c) { const m = bodyMass(), f = Math.sqrt(Math.max(0.01, (m - c) / m)); P.H *= f; P.W *= f; setHud(); }
function stepFx(i) { note(60 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19][i % 12], 0.22, 0.14); buzz(8); const st = stairs[i]; burst(world, new THREE.Vector3(0, st.y + 0.1, st.z), [STEP_COLS[i], '#ffffff'], 10, { speed: 0.1, up: 0.06 }); ui.pop('x' + st.m.toFixed(1), '#fff', 40 + i * 2, 30); st.mesh.position.y += 0.08; }

buildLevel();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() {
    if (state !== 'play') return;
    const next = rows.find(r => !r.done);
    if (!next) { botX = 0; return; }
    if (next.kind === 'gates') {
      // value a gate by the mass it leaves us with, avoiding growth that the next beam/gap would just slice off
      const after = rows[rows.indexOf(next) + 1];
      let bx = 0, bv = -1e9;
      for (const g of next.gates) {
        let H = P.H + (g.axis === 'h' ? g.d : 0), W = P.W + (g.axis === 'w' ? g.d : 0);
        if (after && after.kind === 'bar') H = Math.min(H, (after.h - 0.06) / BASE_H);
        if (after && after.kind === 'gap') W = Math.min(W, (after.gw * 0.92) / 0.72);
        const v = H * W - (H < MIN_H + 0.1 || W < MIN_W + 0.1 ? 5 : 0); if (v > bv) { bv = v; bx = g.x; }
      }
      botX = bx;
    } else if (next.kind === 'gap') botX = next.gx;
    else { const gm = gemsArr.find(g => !g.got && g.z < P.z && g.z > P.z - 8); botX = gm ? gm.x : P.x; }
  },
};

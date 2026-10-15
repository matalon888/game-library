// Plumplop — aim and drop berries, plums and melons into the crate. Two of a kind squish into the next size up.
// Our own 2D circle physics (verlet + substeps) drives the 3D models. Anything resting over the line too long ends the run.
import { THREE, createStage, createUI, loop, glossy, mat, rounded, burst, confetti, sfx, tone, note, buzz, store, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { FRUITS, fruitMesh } from './fruits.js';
import { board } from './kit/board.js';
const B = board({ game: 'plumplop', label: 'Points', limits: { maxRun: 20000, maxPerSec: 60 } });   // world board (RULES.md part C)

const NAME = 'Plumplop: Drop & Combine';
const S = createStage({ fov: 32, shadowSize: 8 });
const { scene, camera, sun, hemi } = S;
sun.position.set(1.5, 13, 16); sun.intensity = 1.3; hemi.intensity = 1.3;
const ui = createUI({ title: 'PLUMPLOP', hint: 'Drag to aim, let go to drop', hand: '👆', progress: false });
const D = daily('plumplop', ui, { name: NAME });
ui.els.win.querySelector('p').innerHTML = 'SCORE <span data-l></span>'; ui.els.win.querySelector('h1').textContent = 'NEW BEST!';
const save = store('plumplop');
const F = flow('plumplop', { par: 900, warmup: 150 });
let best = save.get('best', 0), score = 0, state = 'ready';
const css = document.createElement('style'); css.textContent = `
body{--bg1:#ffe3c4;--bg2:#ffd0dc}
.hc-score{top:calc(16px + env(safe-area-inset-top));color:#fff;-webkit-text-stroke:6px rgba(150,70,60,.35);paint-order:stroke fill}
.hc-sub{top:calc(68px + env(safe-area-inset-top));color:#a4574e;text-shadow:none;font-weight:800}
.hc-card{background:rgba(120,60,60,.16)} .hc-card.dim{background:rgba(80,30,40,.38)}
.hc-pop{-webkit-text-stroke:7px rgba(170,70,60,.7);paint-order:stroke fill}
.pp-next{position:fixed;top:calc(18px + env(safe-area-inset-top));right:14px;z-index:6;background:rgba(255,255,255,.8);border-radius:18px;padding:4px 10px 6px;display:flex;flex-direction:column;align-items:center;color:#a4574e;font:800 13px 'Baloo 2',system-ui;box-shadow:0 4px 0 rgba(150,70,60,.15);pointer-events:none}
.pp-next i{width:30px;height:30px;border-radius:50%;margin-top:2px;box-shadow:inset -4px -5px 0 rgba(0,0,0,.15)}
.pp-ring{position:fixed;bottom:calc(14px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;gap:3px;align-items:center;z-index:5;background:rgba(255,255,255,.55);padding:5px 10px;border-radius:20px;pointer-events:none}
.pp-ring b{display:block;border-radius:50%;box-shadow:inset -2px -3px 0 rgba(0,0,0,.15);opacity:.35;transition:opacity .3s,transform .3s}
.pp-ring b.on{opacity:1}
`; document.head.appendChild(css);
const nextEl = document.createElement('div'); nextEl.className = 'pp-next'; nextEl.innerHTML = 'NEXT<i></i>'; document.body.appendChild(nextEl);
const ringEl = document.createElement('div'); ringEl.className = 'pp-ring';
ringEl.innerHTML = FRUITS.map((f, i) => `<b style="width:${10 + i * 1.8}px;height:${10 + i * 1.8}px;background:${f.c[0]}"></b>`).join(''); document.body.appendChild(ringEl);
let bestType = save.get('bestType', 2);
const markRing = () => ringEl.querySelectorAll('b').forEach((b, i) => b.classList.toggle('on', i <= bestType));

// ---------------------------------------------------------------- the crate
const W = 6.2, HB = 8.6, LINE = HB - 1.0, DROP_Y = HB + 0.9;
const crate = new THREE.Group(); scene.add(crate);
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d - 1.8 * r, r);   // exact outer size
const wood = mat('#ffd9a3', { roughness: 0.6, emissive: '#ffb870', emissiveIntensity: 0.12 }), wood2 = mat('#f5c27f', { roughness: 0.6 });
{
  const back = new THREE.Mesh(rounded(W + 0.9, HB + 0.5, 0.3, 0.12), mat('#fff6ea', { roughness: 0.9, emissive: '#fff1de', emissiveIntensity: 0.45 })); back.position.set(0, HB / 2 - 0.1, -1.85); back.receiveShadow = true; crate.add(back);
  for (let k = 0; k < 5; k++) { const pl = new THREE.Mesh(rounded(W + 0.6, 0.06, 0.04, 0.02), mat('#f7dcc0', { emissive: '#f7dcc0', emissiveIntensity: 0.3 })); pl.position.set(0, 0.9 + k * 1.75, -1.68); crate.add(pl); }
  const floor = new THREE.Mesh(rbox(W + 1.0, 0.5, 3.4, 0.15), wood2); floor.position.set(0, -0.25, 0); floor.receiveShadow = true; crate.add(floor);
  for (const sx of [-1, 1]) { const wall = new THREE.Mesh(rbox(0.42, HB + 0.4, 3.4, 0.15), wood); wall.position.set(sx * (W / 2 + 0.21), HB / 2 - 0.2, 0); wall.castShadow = true; wall.receiveShadow = true; crate.add(wall); }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.ShadowMaterial({ opacity: 0.12 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = true; crate.add(ground);
}
const lineMat = new THREE.MeshBasicMaterial({ color: '#ff5a6e', transparent: true, opacity: 0.0 });
const lineMesh = new THREE.Group(); for (let k = 0; k < 14; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), lineMat); d.position.set(-W / 2 + 0.22 + k * (W - 0.44) / 13, LINE, 1.2); lineMesh.add(d); } crate.add(lineMesh);
const guide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.04), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })); guide.position.z = 0; crate.add(guide);

function fit() {
  const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const needW = (W + 1.4) / 0.96, needH = (DROP_Y + 1.4 + 0.8) / 0.74;
  const d = Math.max(needW / (2 * tn * camera.aspect), needH / (2 * tn));
  const cy = (DROP_Y + 0.6) / 2 + 0.25;
  camera.position.set(0, cy + 1.2, d);
  camera.lookAt(0, cy - 0.15, 0);
}
addEventListener('resize', fit); fit();

// ---------------------------------------------------------------- bodies + physics
let bodies = [], held = null, nextType = 0, aimX = 0, cool = 0, overT = 0, dropCount = 0, recorded = false, beatenShown = false, chain = 0, chainT = 0, R = Math.random;
const G = -26, SUB = 6, VMAX = 0.085;
function spawnBody(type, x, y, vx = 0, vy = 0) {
  const f = FRUITS[type], m = fruitMesh(type); crate.add(m);
  const b = { type, r: f.r, x, y, px: x - vx, py: y - vy, rot: (R() - 0.5) * 0.4, mesh: m, pop: 0, born: performance.now(), dead: false, mass: f.r * f.r };
  m.position.set(x, y, 0); bodies.push(b); return b;
}
function pickType() {
  const fk = F.k(score), w = [1, 1, 0.9, 0.55 * fk, 0.3 * fk * fk];
  const tot = w.reduce((a, c) => a + c, 0); let r = R() * tot; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return 0;
}
function newHeld() {
  held = { type: nextType, mesh: fruitMesh(nextType), s: 0 }; crate.add(held.mesh);
  nextType = pickType(); nextEl.querySelector('i').style.background = FRUITS[nextType].c[0];
}
function drop() {
  if (!held || cool > 0 || state !== 'play') return;
  const f = FRUITS[held.type], x = clamp(aimX + (Math.random() - 0.5) * 0.06, -W / 2 + f.r, W / 2 - f.r);
  crate.remove(held.mesh);
  const b = spawnBody(held.type, x, DROP_Y, 0, -0.02); b.mesh.scale.setScalar(1);
  held = null; cool = 0.55; dropCount++; tone(330, 0.07, 'sine', 0.1, 0.7); buzz(6);
}

const DT = 1 / 60 / SUB;
function physics() {
  for (let s = 0; s < SUB; s++) {
    for (const b of bodies) {
      let vx = (b.x - b.px) * 0.998, vy = (b.y - b.py) * 0.998; const sp = Math.hypot(vx, vy); if (sp > VMAX) { vx *= VMAX / sp; vy *= VMAX / sp; }
      b.r = FRUITS[b.type].r * (1 - 0.35 * b.pop);
      b.px = b.x; b.py = b.y; b.x += vx; b.y += vy + G * DT * DT;
    }
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i]; if (a.dead) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j]; if (b.dead) continue;
          let dx = b.x - a.x; const dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) continue;
          if (a.type === b.type && !a.merge && !b.merge) { merge(a, b); continue; }
          if (Math.abs(dx) < 0.004) dx += (Math.random() - 0.5) * 0.01;   // perfect towers are not a thing
          const d = Math.sqrt(d2), o = (rr - d), nx = dx / d, ny = dy / d, ta = b.mass / (a.mass + b.mass), tb = 1 - ta;
          a.x -= nx * o * ta; a.y -= ny * o * ta; b.x += nx * o * tb; b.y += ny * o * tb;
          // a little tangential friction so piles settle instead of sliding forever
          const rvx = (b.x - b.px) - (a.x - a.px), rvy = (b.y - b.py) - (a.y - a.py), tv = rvx * -ny + rvy * nx, fr = 0.04;
          a.px -= -ny * tv * fr * ta; a.py -= nx * tv * fr * ta; b.px += -ny * tv * fr * tb; b.py += nx * tv * fr * tb;
        }
      }
      for (const b of bodies) {
        if (b.dead) continue;
        const L = -W / 2 + b.r, Rr = W / 2 - b.r;
        if (b.x < L) { b.x = L; } if (b.x > Rr) { b.x = Rr; }
        if (b.y < b.r) { b.y = b.r; b.px = lerp(b.px, b.x, 0.06); }
      }
    }
    bodies = bodies.filter((b) => !b.dead);
  }
  for (const b of bodies) {
    const vx = b.x - b.px; b.rot -= vx / b.r;
    if (Math.abs(vx) < 1e-5 && Math.abs(b.y - b.py) < 1e-5) { b.px = b.x; b.py = b.y; }
  }
}
function merge(a, b) {
  a.dead = b.dead = true; a.merge = b.merge = true;
  crate.remove(a.mesh); crate.remove(b.mesh);
  const x = (a.x * a.mass + b.x * b.mass) / (a.mass + b.mass), y = (a.y * a.mass + b.y * b.mass) / (a.mass + b.mass), t = a.type;
  const col = FRUITS[t].c[0];
  chain = chainT > 0 ? chain + 1 : 1; chainT = 0.9;
  const pts = (t + 1) * (t + 2) / 2 * Math.min(3, chain); score += pts; ui.score(score);
  burst(crate, new THREE.Vector3(x, y, 0.6), [col, '#ffffff', FRUITS[Math.min(10, t + 1)].c[0]], 10 + t * 3, { speed: 0.07 + t * 0.012, up: 0.08, size: 0.5 + t * 0.06, shape: 'sphere' });
  note(60 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17][t], 0.3, 0.16); buzz(10 + t * 3);
  if (t === 10) { score += 200; ui.score(score); confetti(crate, new THREE.Vector3(x, y, 1), 90); ui.pop('DOUBLE MELON!', '#fff', 40, 24); ui.flash(0.5); sfx.win(); return; }
  const nb = spawnBody(t + 1, x, y, ((a.x - a.px) + (b.x - b.px)) / 2, Math.max(0, ((a.y - a.py) + (b.y - b.py)) / 2) + 0.01);
  nb.pop = 1; nb.merge = false;
  if (t + 1 > bestType) { bestType = t + 1; save.set('bestType', bestType); markRing(); if (t + 1 >= 5) { ui.pop(`${FRUITS[t + 1].name.toUpperCase()}!`, '#fff', 38, 24); confetti(crate, new THREE.Vector3(x, y + 1, 1), 40); } }
  else if (chain >= 2) ui.pop(`CHAIN x${chain}!`, '#fff', 34, 24);
  else if (t >= 6) ui.pop(`+${pts}`, '#fff', 32, 24);
  if (t >= 6) ui.flash(0.2);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 24); confetti(crate, new THREE.Vector3(0, LINE, 1), 50); }
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
function aimAt(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hit)) aimX = clamp(hit.x, -W / 2, W / 2); }
let down = false;
addEventListener('pointerdown', (e) => { if (state !== 'play') return; down = true; aimAt(e.clientX, e.clientY); });
addEventListener('pointermove', (e) => { if (down && state === 'play') aimAt(e.clientX, e.clientY); });
addEventListener('pointerup', () => { if (down && state === 'play') drop(); down = false; });

// ---------------------------------------------------------------- run lifecycle
function reset() {
  for (const b of bodies) crate.remove(b.mesh); bodies = [];
  if (held) crate.remove(held.mesh); held = null;
  R = D.seed ? (() => { let s = D.seed % 2147483647; return () => (s = (s * 16807) % 2147483647) / 2147483647; })() : Math.random;
  score = 0; ui.score(0); cool = 0; overT = 0; dropCount = 0; recorded = false; beatenShown = false; chain = 0; aimX = 0;
  nextType = pickType(); newHeld();
  ui.sub(best ? `BEST ${best}` : ''); markRing();
}
function gameOver() {
  state = 'lost'; if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best; if (nb) { best = score; save.set('best', best); }
  sfx.fail(); buzz([40, 60, 40]); ui.flash(0.4);
  for (const b of bodies) if (b.y + b.r > LINE) burst(crate, new THREE.Vector3(b.x, b.y, 0.5), '#ff5a6e', 8, { speed: 0.06, size: 0.5 });
  if (nb && score > 0) { state = 'won'; D.won(score); ui.win(score, `Biggest yet: ${FRUITS[bestType].name}`); }
  else ui.lose('CRATE FULL!', `${score} point${score === 1 ? '' : 's'}` + (best ? ` · best ${best}` : ''));
}
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; return; } reset(); state = 'play'; });
reset(); ui.start();

// ---------------------------------------------------------------- bot
function bot() {
  if (state !== 'play' || !held || cool > 0) return;
  const t = held.type, fr = FRUITS[t].r; let tx = null, by = -1;
  for (const b of bodies) {
    if (b.type !== t) continue;
    const covered = bodies.some((o) => o !== b && o.y > b.y + 0.2 && Math.abs(o.x - b.x) < (o.r + b.r) * 0.8);
    if (!covered && b.y > by) { by = b.y; tx = b.x; }
  }
  if (tx === null) {
    let bestH = 1e9; for (let k = 0; k <= 16; k++) {
      const x = -W / 2 + fr + (W - 2 * fr) * k / 16; let h = 0;
      for (const b of bodies) { const dx = Math.abs(b.x - x); if (dx < b.r + fr) h = Math.max(h, b.y + Math.sqrt(Math.max(0, (b.r + fr) ** 2 - dx * dx))); }
      h += Math.random() * 0.3; if (h < bestH) { bestH = h; tx = x; }
    }
  }
  aimX = tx + (Math.random() - 0.5) * 0.1; drop();
}

// ---------------------------------------------------------------- loop
let time = 0;
loop((dt) => {
  const h = dt / 60; time += h;
  if (state === 'play') {
    cool = Math.max(0, cool - h); chainT = Math.max(0, chainT - h);
    if (!held && cool <= 0) newHeld();
    physics();
    // danger: something resting above the line (not the fruit that's still falling in)
    const now = performance.now(); let over = false;
    for (const b of bodies) if (now - b.born > 1500 && b.y + b.r > LINE && Math.abs(b.y - b.py) < 0.02) over = true;
    overT = over ? overT + h : Math.max(0, overT - h * 2);
    if (overT > 2.2) gameOver();
  }
  lineMat.opacity = overT > 0 ? 0.5 + 0.5 * Math.sin(time * 18) : lerp(lineMat.opacity, 0.35, 0.1);
  for (const b of bodies) {
    b.mesh.position.set(b.x, b.y, 0); b.mesh.rotation.z = b.rot;
    if (b.pop > 0) { b.pop = Math.max(0, b.pop - h * 3.2); const k = 1 - b.pop; const s = k < 0.7 ? 0.55 + k / 0.7 * 0.6 : 1.15 - (k - 0.7) / 0.3 * 0.15; b.mesh.scale.setScalar(s); } else b.mesh.scale.setScalar(1);
  }
  if (held) {
    const f = FRUITS[held.type], x = clamp(aimX, -W / 2 + f.r, W / 2 - f.r);
    held.s = Math.min(1, held.s + h * 5);
    held.mesh.position.set(lerp(held.mesh.position.x || x, x, 0.4), DROP_Y + Math.sin(time * 3) * 0.05, 0); held.mesh.scale.setScalar(held.s); held.mesh.rotation.z = Math.sin(time * 2) * 0.08;
    guide.visible = state === 'play'; guide.position.x = held.mesh.position.x; guide.scale.y = DROP_Y - f.r; guide.position.y = (DROP_Y - f.r) / 2;
  } else guide.visible = false;
});

window.__game = { get state() { return state; }, get level() { return bestType + 1; }, get score() { return score; }, bot, get n() { return bodies.length; } };

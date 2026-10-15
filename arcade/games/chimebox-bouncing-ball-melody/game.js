// Chimebox — balls bounce inside a shape; every wall hit plays the next note of a public-domain melody and makes that ball grow.
// Golden walls play the note with a chord, count double and SHRINK the ball. Tap to turn the box one side so a golden wall
// swings under the falling ball. Finish the song before any ball fills the box. New balls join as the song goes on.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { SONG } from './_music/songs.js';

const NAME = 'Chimebox: Bouncing Ball Melody';
const S = store('chimebox');
let level = +new URLSearchParams(location.search).get('level') || S.get('level', 1);
let best = S.get('best', 0);
const F = flow('chimebox');

const stage = createStage({ fov: 40, shadowSize: 8 });
const { scene, camera, sun } = stage;
sun.position.set(2, 5, 14); sun.intensity = 1.4;
const ui = createUI({ title: 'CHIMEBOX', hint: 'Tap to turn the box', hand: '👆' });
const D = daily('chimebox', ui, { name: NAME });

const ORDER = ['twinkle', 'ode', 'minuet', 'saints', 'elise', 'canon', 'cancan', 'mountain', 'turkish'];
const SHAPES = [0, 6, 4, 5, 3, 8];                 // 0 = circle
const SKIES = [['#ffd6e8', '#fff2c7'], ['#cde7ff', '#f3e5ff'], ['#d4f5e4', '#fff6d6'], ['#ffe0c2', '#ffe1ef'], ['#e3d6ff', '#d7f3ff'], ['#ffd1d1', '#fff0dc']];
const WALLS = ['#ff7eb6', '#6c8cff', '#36c99a', '#ff9a4a', '#9a6bff', '#ff5d6c'];
const BALLC = ['#3ab7ff', '#ff6fa3', '#59d98e', '#b07bff', '#ff8c42'];
const GRAV = 9.5, RI = 3.0, R0 = 0.34, WALL_T = 0.32;

// ---------------------------------------------------------------- shared props
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const noteTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.font = 'bold 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♪', 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const box = new THREE.Group(); scene.add(box);
const plate = new THREE.Group(); scene.add(plate);
const ripples = [], notesFx = [];
const RIP_G = new THREE.RingGeometry(0.8, 1, 40);

// ---------------------------------------------------------------- melody strip (shows the notes coming up, like a tiny music staff)
const staffCss = document.createElement('style');
staffCss.textContent = `.cb-staff{position:fixed;left:0;right:0;bottom:calc(46px + env(safe-area-inset-bottom));display:flex;justify-content:center;pointer-events:none;z-index:5}
.cb-in{position:relative;width:min(340px,86vw);height:92px;border-radius:24px;background:rgba(255,255,255,.5);box-shadow:0 6px 18px rgba(0,0,0,.08)}
.cb-l{position:absolute;left:16px;right:16px;height:2px;border-radius:2px;background:rgba(0,0,0,.08)}
.cb-n{position:absolute;width:20px;height:16px;margin:-8px 0 0 -10px;border-radius:50%;background:var(--ui,#ff7eb6);transform:rotate(-18deg);transition:left .25s ease,top .25s ease,opacity .25s,transform .25s;box-shadow:0 2px 0 rgba(0,0,0,.12)}
.cb-n.done{opacity:.25}.cb-n.now{transform:rotate(-18deg) scale(1.45);background:#ffb300;box-shadow:0 0 0 4px rgba(255,179,0,.25)}`;
document.head.appendChild(staffCss);
const staff = document.createElement('div'); staff.className = 'cb-staff'; staff.innerHTML = '<div class="cb-in"></div>'; document.body.appendChild(staff);
const staffIn = staff.firstChild;
for (let i = 0; i < 5; i++) { const l = document.createElement('div'); l.className = 'cb-l'; l.style.top = (18 + i * 14) + 'px'; staffIn.appendChild(l); }
const heads = []; for (let i = 0; i < 9; i++) { const h = document.createElement('div'); h.className = 'cb-n'; staffIn.appendChild(h); heads.push(h); }
let lo = 60, hi = 84;
function renderStaff() {
  const w = staffIn.clientWidth || 300;
  for (let i = 0; i < heads.length; i++) {
    const k = ni - 2 + i, h = heads[i], n = seq[k];
    if (!n || k < 0) { h.style.opacity = 0; continue; }
    h.style.opacity = ''; h.className = 'cb-n' + (k < ni ? ' done' : k === ni ? ' now' : '');
    h.style.left = (28 + i * (w - 56) / 8) + 'px';
    h.style.top = (76 - (n[1] - lo) / Math.max(1, hi - lo) * 60) + 'px';
  }
}

// ---------------------------------------------------------------- state
let state = 'ready', sides = 0, phi = 0, phiT = 0, step = Math.PI / 4, balls = [], gold = [], song, seq = [], ni = 0, need = 40, grow = 0.05, limit = 2.4;
let score = 0, recorded = false, beatenShown = false, wallMat, goldMat, warn = 0, spawnAt = [], clock = 0, r = rng(1), turns = 0, shake = 0;

function polyPts(n, R) { const pts = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + Math.PI / n + i * 2 * Math.PI / n; pts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R)); } return pts; }
// edge k (polygon): from vertex k to k+1; its outward normal angle (shape frame) = -π/2 + (2k+1)π/n + π/n ... computed directly below
function edgeNormalAngle(k) { return -Math.PI / 2 + Math.PI / sides + k * 2 * Math.PI / sides + Math.PI / sides; }

function buildBox() {
  box.clear(); plate.clear();
  const col = WALLS[(level - 1) % WALLS.length];
  wallMat = glossy(col, { emissive: col, emissiveIntensity: 0.15 }); goldMat = glossy('#ffd23f', { emissive: '#ffb300', emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.25 });
  const outer = new THREE.Shape(), hole = new THREE.Path();
  if (sides === 0) { outer.absarc(0, 0, RI + WALL_T, 0, Math.PI * 2, false); hole.absarc(0, 0, RI, 0, Math.PI * 2, true); }
  else {
    const Ro = (RI + WALL_T) / Math.cos(Math.PI / sides), Rin = RI / Math.cos(Math.PI / sides);
    const po = polyPts(sides, Ro), pi = polyPts(sides, Rin).reverse();
    outer.setFromPoints(po); hole.setFromPoints(pi);
  }
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 64 }); g.translate(0, 0, -0.35);
  const m = new THREE.Mesh(g, wallMat); m.castShadow = true; m.receiveShadow = true; box.add(m);
  // backdrop inside the box
  const back = sides === 0 ? new THREE.CircleGeometry(RI, 64) : new THREE.ShapeGeometry(new THREE.Shape(polyPts(sides, RI / Math.cos(Math.PI / sides))));
  const bm = new THREE.Mesh(back, mat('#ffffff', { transparent: true, opacity: 0.6, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.55 })); bm.position.z = -0.4; bm.receiveShadow = true; box.add(bm);
}
function goldMesh(gs) {
  let m;
  if (sides === 0) { m = new THREE.Mesh(new THREE.TorusGeometry(RI - 0.04, 0.2, 10, 24, gs.len), goldMat); m.rotation.z = gs.a - gs.len / 2; m.position.z = 0.15; }
  else {
    const len = 2 * RI * Math.tan(Math.PI / sides) * 0.86, na = edgeNormalAngle(gs.k);
    m = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, len - 0.4, 4, 10), goldMat);
    m.position.set(Math.cos(na) * (RI - 0.04), Math.sin(na) * (RI - 0.04), 0.15); m.rotation.z = na;
  }
  m.castShadow = true; box.add(m); gs.m = m; gs.pulse = 1;
}
function placeGold(gs, avoidA = null) {
  if (gs.m) { box.remove(gs.m); gs.m = null; }
  for (let tries = 0; tries < 12; tries++) {
    if (sides === 0) { gs.a = r() * Math.PI * 2; gs.len = 0.8; }
    else { gs.k = Math.floor(r() * sides); gs.a = edgeNormalAngle(gs.k); gs.len = 2 * Math.PI / sides; }
    if (gold.some(o => o !== gs && o.m && Math.abs(Math.atan2(Math.sin(o.a - gs.a), Math.cos(o.a - gs.a))) < 0.6)) continue;
    if (avoidA !== null && Math.abs(Math.atan2(Math.sin(avoidA - (gs.a + phi)), Math.cos(avoidA - (gs.a + phi)))) < 1.2) continue;
    break;
  }
  goldMesh(gs);
}

function makeBall(i, x, y) {
  const c = BALLC[i % BALLC.length], m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), glossy(c, { emissive: c, emissiveIntensity: 0.12 }));
  m.castShadow = true; scene.add(m);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })); hl.position.set(-0.35, 0.4, 0.75); hl.scale.set(1, 0.7, 0.4); m.add(hl);
  const a = r() * Math.PI * 2;
  return { m, c, x, y, vx: Math.cos(a) * 4, vy: 3 + r() * 2, r: R0, sq: 0, rt: R0 };
}

function build() {
  const seed = D.seed || level * 7919 + 211; r = rng(seed); const fk = F.k();
  const sky = SKIES[(level - 1) % SKIES.length], bs = document.body.style;
  bs.setProperty('--bg1', sky[0]); bs.setProperty('--bg2', sky[1]); bs.setProperty('--ui', WALLS[(level - 1) % WALLS.length]);
  sides = SHAPES[(level - 1) % SHAPES.length]; step = sides ? 2 * Math.PI / sides : Math.PI / 4;
  phi = phiT = 0; turns = 0;
  buildBox();
  song = SONG[ORDER[(level - 1) % ORDER.length]];
  need = clamp(22 + level * 4, 24, 80);
  seq = []; while (seq.length < need) for (const n of song.notes) { if (seq.length >= need) break; seq.push(n); }
  ni = 0; lo = Math.min(...seq.map(n => n[1])); hi = Math.max(...seq.map(n => n[1])); renderStaff();
  for (const b of balls) scene.remove(b.m); balls = [];
  limit = RI * (sides === 3 ? 0.62 : 0.8);       // a ball this big fills the box
  // growth per plain hit: a lone ball would fill after ~55% of the song on plain walls alone
  grow = clamp((limit - R0) / (need * 0.55) * fk, 0.015, 0.2);
  balls.push(makeBall(0, 0, 0.5));
  spawnAt = level >= 2 ? [Math.round(need * 0.4), Math.round(need * 0.75)] : [Math.round(need * 0.5)];
  for (const gs of gold) if (gs.m) box.remove(gs.m);
  gold = []; const ng = level <= 2 ? 2 : clamp(Math.round(2 / fk), 1, 2);
  for (let i = 0; i < ng; i++) { const gs = {}; gold.push(gs); placeGold(gs); }
  score = 0; recorded = false; beatenShown = false; warn = 0;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(`♪ ${song.title}` + (D.isDaily ? ' · DAILY' : ''));
}

function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, 2, 1), 50); }
}

function chordFor(u) { const bar = song.bars[Math.floor(u / song.barLen) % song.bars.length]; const half = (u % song.barLen) >= song.barLen / 2 && bar.length > 1 ? 1 : 0; return bar[half]; }

function playHit(b, wx, wy, golden) {
  const n = seq[ni % seq.length], u = n[0], midi = n[1];
  const beatSec = 60 / song.bpm / song.unit;
  note(midi, clamp(n[2] * beatSec * 1.6, 0.25, 0.9), golden ? 0.2 : 0.17);
  const ch = chordFor(u);
  if (golden) { for (const tn of ch.tones) note(60 + tn, 0.7, 0.06); note(36 + ch.root + 12, 0.8, 0.12); }
  else if (ni % 2 === 0) note(36 + ch.root + 12, 0.45, 0.07);
  ni += golden ? 2 : 1; if (golden && ni < need && seq[ni - 1]) setTimeout(() => note(seq[ni - 1][1], 0.3, 0.12), 110);
  addScore(golden ? 5 : 1);
  // fx: ripple on the wall + a floating note
  const rp = new THREE.Mesh(RIP_G, new THREE.MeshBasicMaterial({ color: golden ? '#ffd23f' : '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  rp.position.set(wx, wy, 0.4); rp.scale.setScalar(0.2); scene.add(rp); ripples.push({ m: rp, t: 0 });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, color: golden ? '#ffd23f' : b.c, transparent: true, depthWrite: false }));
  sp.position.set(wx * 0.92, wy * 0.92, 0.6); sp.scale.setScalar(golden ? 0.9 : 0.6); scene.add(sp); notesFx.push({ m: sp, t: 0, vx: (Math.random() - 0.5) * 0.6 });
  burst(scene, new THREE.Vector3(wx, wy, 0.3), golden ? ['#ffd23f', '#ffffff', '#ff9a4a'] : [b.c, '#ffffff'], golden ? 14 : 5, { speed: golden ? 0.1 : 0.06, up: 0.02, size: golden ? 0.5 : 0.35, gravity: 0.002 });
  buzz(golden ? [10, 20, 10] : 5);
  ui.progress(ni / need); renderStaff();
  if (golden) ui.pop(b.r <= R0 + 0.01 ? 'GOLDEN!' : 'SHRINK!', '#ffb300', 32, 28);
  if (spawnAt.length && ni >= spawnAt[0]) { spawnAt.shift(); const nb = makeBall(balls.length, 0, 0); balls.push(nb); ui.pop('+1 BALL', '#fff', 32, 34); tone(880, 0.1, 'triangle', 0.1, 1.5); }
  if (ni >= need) win();
}

function wallHit(b, nx, ny, golden, gs) {
  // nx, ny = outward normal (world)
  const vn = b.vx * nx + b.vy * ny; if (vn <= 0) return;
  b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
  const sp = Math.hypot(b.vx, b.vy), want = clamp(sp, 5.5, 9.5); b.vx *= want / sp; b.vy *= want / sp;
  b.sq = 1;
  if (state !== 'play') return;
  if (golden) { b.rt = Math.max(R0, b.rt - grow * 2.2); gs.pulse = 1; placeGold(gs, Math.atan2(ny, nx)); }
  else b.rt += grow;
  playHit(b, b.x + nx * b.r, b.y + ny * b.r, golden);
  if (state === 'play' && b.rt >= limit) lose(b);
}

function physics(h) {
  for (const b of balls) {
    b.vy -= GRAV * h; b.x += b.vx * h; b.y += b.vy * h;
    b.r = lerp(b.r, b.rt, Math.min(1, 10 * h));
    if (sides === 0) {
      const d = Math.hypot(b.x, b.y);
      if (d + b.r > RI) {
        const nx = b.x / d, ny = b.y / d; b.x = nx * (RI - b.r); b.y = ny * (RI - b.r);
        const la = Math.atan2(ny, nx) - phi, gs = gold.find(g => Math.abs(Math.atan2(Math.sin(la - g.a), Math.cos(la - g.a))) < g.len / 2 + 0.05);
        wallHit(b, nx, ny, !!gs, gs);
      }
    } else {
      for (let k = 0; k < sides; k++) {
        const na = edgeNormalAngle(k) + phi, nx = Math.cos(na), ny = Math.sin(na);
        const dist = b.x * nx + b.y * ny;          // distance from centre along the outward normal
        if (dist + b.r > RI) {
          b.x -= nx * (dist + b.r - RI); b.y -= ny * (dist + b.r - RI);
          const gs = gold.find(g => g.k === k);
          wallHit(b, nx, ny, !!gs, gs);
        }
      }
    }
  }
  // ball-ball: soft elastic
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], c = balls[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), md = a.r + c.r;
    if (d < md && d > 1e-4) {
      const nx = dx / d, ny = dy / d, ov = (md - d) / 2; a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) { const ma = a.r * a.r, mc = c.r * c.r, jj = -2 * rv / (ma + mc); a.vx -= jj * mc * nx; a.vy -= jj * mc * ny; c.vx += jj * ma * nx; c.vy += jj * ma * ny; tone(1200, 0.03, 'sine', 0.04, 0.9); }
    }
  }
}

function turn() {
  if (state !== 'play') return;
  phiT += step; turns++;
  tone(500 + (turns % 4) * 60, 0.06, 'triangle', 0.09, 1.3); buzz(6);
}

function lose(b) {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, ni / need); }
  best = Math.max(best, score); S.set('best', best);
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.4); shake = 0.5;
  burst(scene, new THREE.Vector3(b.x, b.y, 0.5), [b.c, '#ffffff'], 26, { speed: 0.16, up: 0.06, size: 0.7, gravity: 0.003 });
  ui.lose('FULL!', `${Math.min(ni, need)} of ${need} notes of ${song.title}`);
}
function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); }
  addScore(25 + level * 5);
  best = Math.max(best, score); S.set('best', best);
  const ch = chordFor(seq[need - 1][0]);
  setTimeout(() => { for (const tn of ch.tones) note(72 + tn, 1.2, 0.1); note(48 + ch.root, 1.4, 0.14); }, 250);
  buzz([20, 40, 20]); ui.flash(0.35);
  confetti(scene, new THREE.Vector3(0, 1, 1), 110);
  D.won(score); ui.win(level, `${song.title} · ${score} points`);
}

input({ onDown: () => turn() });
ui.onTap(w => {
  if (w === 'win') { level++; S.set('level', level); build(); }
  else if (w === 'lose') build();
  state = 'play'; ui.els.sc.classList.remove('hc-hidden');
});

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  clock = t; const st = dt / 60;
  const prevPhi = phi; phi = lerp(phi, phiT, Math.min(1, 16 * st));
  if (state === 'play') { for (let i = 0; i < 6 && state === 'play'; i++) physics(st / 6); }
  else if (state === 'ready') { phiT += st * 0.3; for (let i = 0; i < 3; i++) physics(st / 3); }
  box.rotation.z = phi;
  // balls
  let maxFrac = 0;
  for (const b of balls) {
    b.sq = Math.max(0, b.sq - st * 6);
    b.m.position.set(b.x, b.y, 0); b.m.scale.set(b.r * (1 + b.sq * 0.12), b.r * (1 - b.sq * 0.12), b.r);
    const f = (b.rt - R0) / (limit - R0); maxFrac = Math.max(maxFrac, f);
    b.m.material.emissive.set(f > 0.8 && state === 'play' ? '#ff2d55' : b.c); b.m.material.emissiveIntensity = f > 0.8 ? 0.2 + 0.25 * Math.abs(Math.sin(t * 10)) : 0.12;
  }
  if (state !== 'play') { if (state === 'lost') for (const b of balls) b.m.visible = false; }
  warn = lerp(warn, maxFrac > 0.8 && state === 'play' ? 1 : 0, 0.1);
  wallMat.emissiveIntensity = 0.15 + warn * 0.25 * Math.abs(Math.sin(t * 8));
  for (const gs of gold) if (gs.m) { gs.pulse = Math.max(0, gs.pulse - st * 2); if (sides) gs.m.scale.set(1 + gs.pulse * 0.6, 1, 1 + gs.pulse * 0.6); }
  goldMat && (goldMat.emissiveIntensity = 0.4 + Math.sin(t * 5) * 0.15);
  for (let i = ripples.length - 1; i >= 0; i--) { const rp = ripples[i]; rp.t += st; rp.m.scale.setScalar(0.2 + rp.t * 2.4); rp.m.material.opacity = Math.max(0, 0.8 - rp.t * 2); if (rp.t > 0.4) { scene.remove(rp.m); rp.m.material.dispose(); ripples.splice(i, 1); } }
  for (let i = notesFx.length - 1; i >= 0; i--) { const n = notesFx[i]; n.t += st; n.m.position.y += st * 1.6; n.m.position.x += n.vx * st; n.m.material.opacity = Math.max(0, 1 - n.t * 1.2); if (n.t > 0.85) { scene.remove(n.m); n.m.material.dispose(); notesFx.splice(i, 1); } }
  if (state === 'won') { box.rotation.z = phi + Math.sin(t * 6) * 0.03; for (const b of balls) b.m.position.y += Math.sin(t * 8 + b.x) * 0.02; }
  // camera fits the box to the screen width
  shake = Math.max(0, shake - st);
  const vf = camera.fov * Math.PI / 180, R = (sides ? (RI + WALL_T) / Math.cos(Math.PI / sides) : RI + WALL_T) + 0.6;
  const d = Math.max(R / (Math.tan(vf / 2) * camera.aspect), R / Math.tan(vf / 2));
  const sx = (Math.random() - 0.5) * shake * 0.4;
  camera.position.set(sx, -0.6, d); camera.lookAt(sx, -0.6, 0);
  stage.followLight(new THREE.Vector3(0, 0, 0));
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');

// ---------------------------------------------------------------- bot: turn the box so a golden wall sits where the biggest ball will land
function predictHit(b) {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  for (let k = 0; k < 240; k++) {
    const h = 1 / 120; vy -= GRAV * h; x += vx * h; y += vy * h;
    if (sides === 0) { if (Math.hypot(x, y) + b.r > RI) return { a: Math.atan2(y, x), t: k * h }; }
    else for (let e = 0; e < sides; e++) { const na = edgeNormalAngle(e) + phiT; if (x * Math.cos(na) + y * Math.sin(na) + b.r > RI) return { a: na, t: k * h }; }
  }
  return null;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || Math.abs(phiT - phi) > 0.05) return;
    const b = balls.reduce((m, o) => (o.rt > m.rt ? o : m), balls[0]);
    const hit = predictHit(b); if (!hit || hit.t < 0.12) return;
    // after k more turns (each +step) a golden wall's world angle = g.a + phiT + k*step; find the k that lines one up with the hit
    let bestK = 0, bestD = Infinity;
    for (const g of gold) for (let k = 0; k < (sides || 8); k++) {
      const wa = g.a + phiT + k * step, dd = Math.abs(Math.atan2(Math.sin(hit.a - wa), Math.cos(hit.a - wa)));
      if (dd < bestD - 1e-6) { bestD = dd; bestK = k; }
    }
    if (bestK > 0 && bestK * 0.15 < hit.t + 0.2) turn();
  },
};

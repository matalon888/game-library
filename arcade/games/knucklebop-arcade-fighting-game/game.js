// Knucklebop — original 1v1 cartoon fighting game vs a fair CPU. Six original fighters, arcade ladder, best of 3 rounds.
// The CPU uses the same move data and physics as the player; it only sees what happened a reaction-delay ago.
import { THREE, createStage, createUI, loop, store, burst, confetti, sfx, tone, note, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { FIGHTERS, moveSet, buildModel, animate } from './fighters.js';
import { ARENAS, buildArena } from './arena.js';
import { music } from './music.js';

const NAME = 'Knucklebop: Arcade Fighting Game';
const S = store('knucklebop');
const F = flow('knucklebop');
const stage = createStage({ fov: 42, shadowSize: 8 });
const { scene, camera, renderer, sun, hemi, followLight } = stage;
camera.far = 260; camera.updateProjectionMatrix();
const ui = createUI({ title: 'KNUCKLE<br>BOP', hint: 'Tap to choose your fighter', hand: '🥊', progress: false, score: false });
const D = daily('knucklebop', ui, { name: NAME });
const B = board({ game: 'knucklebop', label: 'Fights won', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum', corner: 'tl' });
const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;

// ---------------------------------------------------------------- persistent progress
const DIFFS = ['easy', 'normal', 'hard'];
let diff = S.get('diff', 'easy'), pick = S.get('pick', 0), alts = S.get('alts', [0, 0, 0, 0, 0, 0]);
const rungKey = D.seed ? 'drung' + D.seed : 'rung', loopKey = D.seed ? 'dloop' + D.seed : 'loop';
let rung = S.get(rungKey, 0), lap = S.get(loopKey, 0);
const winsBy = () => S.get('winsBy', [0, 0, 0, 0, 0, 0]);
const unlocked = i => !FIGHTERS[i].locked || S.get('cleared', 0) > 0;
const altOK = i => winsBy()[i] >= 3;
if (!unlocked(pick)) pick = 0;

// ---------------------------------------------------------------- start card: difficulty + tagline
(() => {
  const st = ui.els.start, h = st.querySelector('h1');
  const tag = document.createElement('p'); tag.className = 'kb-tag'; tag.textContent = D.seed ? 'Daily ladder · same rivals for everyone today' : '6 fighters · arcade ladder vs CPU';
  const row = document.createElement('div'); row.className = 'kb-diff';
  for (const d of DIFFS) {
    const b = document.createElement('button'); b.textContent = d[0].toUpperCase() + d.slice(1); b.setAttribute('aria-pressed', d === diff);
    b.addEventListener('pointerdown', e => { e.stopPropagation(); diff = d; S.set('diff', d); row.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); sfx.tap(); });
    row.appendChild(b);
  }
  const hint = st.querySelector('.hint'); st.insertBefore(tag, hint); st.insertBefore(row, hint);
  const small = document.createElement('p'); small.className = 'kb-tag'; small.style.fontSize = '14px'; small.textContent = 'Hard wins count double on the world board'; st.insertBefore(small, hint);
  h.style.marginTop = '20px';
  // win / lose cards: fight wording + a fighters button
  ui.els.win.querySelector('p').firstChild.textContent = 'FIGHT ';
  for (const card of [ui.els.win, ui.els.lose]) {
    const b = document.createElement('button'); b.className = 'kb-cardbtn'; b.textContent = '👤 Change fighter';
    b.addEventListener('pointerdown', e => { e.stopPropagation(); card.classList.add('hc-hidden'); openSelect(); });
    card.querySelector('.hint').before(b);
  }
})();

// ---------------------------------------------------------------- arena
let arena = null, arenaIdx = -1;
function setArena(i) {
  i = i % ARENAS.length; if (i === arenaIdx) return;
  if (arena) scene.remove(arena.group);
  arena = buildArena(i, rng(1234 + i * 99)); arenaIdx = i; scene.add(arena.group);
  const A = arena.A; document.body.style.setProperty('--bg1', A.bg[0]); document.body.style.setProperty('--bg2', A.bg[1]); document.body.style.setProperty('--ui', '#ff5d8f');
  scene.fog = new THREE.Fog(A.fog, 24, 90); hemi.color.set(A.hemi); hemi.groundColor.set(A.ground);
  document.querySelector('meta[name=theme-color]').content = A.bg[0];
}
sun.intensity = 1.8; hemi.intensity = 1.05;
sun.shadow.camera.far = 60;

// ---------------------------------------------------------------- vfx: star sparks, impact rings, dizzy stars
function starGeo(r1, r2, d) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? r2 : r1; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).center(); }
const SPK = 110, sparks = new THREE.InstancedMesh(starGeo(0.5, 0.22, 0.12), new THREE.MeshBasicMaterial({ color: '#ffffff' }), SPK);
sparks.frustumCulled = false; scene.add(sparks);
const spk = Array.from({ length: SPK }, () => ({ life: 0, p: new V3(), v: new V3(), s: 0, r: 0, vr: 0 }));
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3();
for (let i = 0; i < SPK; i++) { sparks.setColorAt(i, _c.set('#fff')); _m.makeScale(0, 0, 0); sparks.setMatrixAt(i, _m); }
let spI = 0;
function spark(x, y, n, colors, power = 1, spread = 1) {
  for (let k = 0; k < n; k++) {
    const i = spI++ % SPK, o = spk[i], a = Math.random() * Math.PI * 2, sp = (0.05 + Math.random() * 0.09) * power * spread;
    o.life = 1; o.p.set(x, y, 0.45); o.v.set(Math.cos(a) * sp, Math.sin(a) * sp + 0.02, (Math.random() - 0.3) * 0.04); o.s = (0.14 + Math.random() * 0.16) * Math.min(1.8, power); o.r = Math.random() * 6; o.vr = (Math.random() - 0.5) * 0.5;
    sparks.setColorAt(i, _c.set(colors[k % colors.length]));
  }
  sparks.instanceColor.needsUpdate = true;
}
function updSparks(dt) {
  for (let i = 0; i < SPK; i++) {
    const o = spk[i];
    if (o.life <= 0) { _m.makeScale(0, 0, 0); sparks.setMatrixAt(i, _m); continue; }
    o.life -= 0.032 * dt; o.v.y -= 0.0035 * dt; o.p.addScaledVector(o.v, dt); o.r += o.vr * dt;
    const s = o.s * (o.life > 0.8 ? (1 - o.life) / 0.2 * 1.25 : Math.max(0, o.life) * 1.25);
    _m.compose(o.p, _q.setFromEuler(_e.set(0, 0, o.r)), _s.set(s, s, s)); sparks.setMatrixAt(i, _m);
  }
  sparks.instanceMatrix.needsUpdate = true;
}
const rings = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 32), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; scene.add(m); return { m, t: 1, s: 1 }; });
let ringI = 0;
function ring(x, y, color = '#fff', size = 1, flat = false) { const r = rings[ringI++ % rings.length]; r.t = 0; r.s = size; r.m.position.set(x, y, 0.5); r.m.rotation.set(flat ? Math.PI / 2 : 0, 0, 0); r.m.material.color.set(color); r.m.visible = true; }
function updRings(dt) { for (const r of rings) { if (!r.m.visible) continue; r.t += 0.075 * dt; const s = r.s * (0.3 + r.t * 1.6); r.m.scale.set(s, s, s); r.m.material.opacity = Math.max(0, 1 - r.t); if (r.t >= 1) r.m.visible = false; } }
const dizzy = new THREE.Group(); { const g = starGeo(0.13, 0.06, 0.05), m = new THREE.MeshBasicMaterial({ color: '#ffd23f' }); for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(g, m); dizzy.add(s); } } dizzy.visible = false; scene.add(dizzy);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff36e', transparent: true, opacity: 0.85, depthWrite: false })); beam.rotation.z = Math.PI / 2; beam.visible = false; scene.add(beam);
const wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: '#ff9cc6', transparent: true, opacity: 0.8, depthWrite: false })); wave.rotation.x = Math.PI / 2; wave.visible = false; scene.add(wave);
const dust = (x, n = 6) => burst(scene, new V3(x, 0.08, 0.3), ['#f4e6d0', '#ffffff'], n, { speed: 0.05, up: 0.03, size: 0.55, shape: 'sphere', gravity: 0.002, life: 0.7 });

// ---------------------------------------------------------------- sounds
const snd = {
  whoosh: () => tone(620, 0.07, 'sine', 0.05, 0.4),
  light: () => { tone(320, 0.06, 'square', 0.1, 0.5); tone(140, 0.09, 'sine', 0.18, 0.5); },
  heavy: () => { tone(200, 0.12, 'square', 0.12, 0.4); tone(80, 0.2, 'sine', 0.26, 0.5); tone(1200, 0.04, 'sawtooth', 0.04, 0.4); },
  block: () => { tone(980, 0.05, 'triangle', 0.09, 0.8); tone(420, 0.06, 'square', 0.04, 0.9); },
  proj: () => tone(420, 0.18, 'sawtooth', 0.05, 1.8),
  jump: () => tone(300, 0.08, 'sine', 0.06, 1.8),
  thud: () => tone(70, 0.22, 'sine', 0.25, 0.5),
  superS: () => [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', 0.06, 1), i * 45)),
  ko: () => { tone(100, 0.5, 'sawtooth', 0.14, 0.3); [784, 659, 523, 392].forEach((f, i) => setTimeout(() => note(60 + [12, 7, 4, 0][i], 0.3, 0.12), 200 + i * 110)); },
  bell: () => { note(84, 0.6, 0.12); note(91, 0.6, 0.06); },
  counter: () => { tone(1500, 0.08, 'triangle', 0.08, 0.6); tone(750, 0.2, 'triangle', 0.08, 1.4); },
};

// ---------------------------------------------------------------- game state
const G = 0.011, WALL = 5.4, MAXSEP = 5.0, ROUND_T = 60;
let state = 'ready', phase = 'none', phaseT = 0, P1 = null, P2 = null, ladder = [], roundNo = 1, clock = ROUND_T, clockF = 0;
let frame = 0, hitstop = 0, slowT = 0, superT = 0, superWho = null, shake = 0, hype = 0, fightT0 = 0, recorded = false, botOn = false, beatenShown = false;
let projs = [], projId = 0, cpuP = null, roundWinner = null;
const BOTP = { react: 2, block: 0.96, combo: 1, aggr: 0.97, anti: 0.9, punish: 1, zone: -1, cool: 2, kd: 0.2 };
const BASE = {
  easy: { react: 26, block: 0.16, combo: 0.25, aggr: 0.36, anti: 0.12, punish: 0.2, zone: 0.25, cool: 26 },
  normal: { react: 17, block: 0.4, combo: 0.55, aggr: 0.55, anti: 0.35, punish: 0.5, zone: 0.35, cool: 16 },
  hard: { react: 11, block: 0.66, combo: 0.85, aggr: 0.72, anti: 0.68, punish: 0.8, zone: 0.4, cool: 10 },
};
function cpuProfile() {
  // flow knobs (honest): reaction delay (/fk), block chance and aggression (*fk); same move data as the player always
  const b = BASE[diff], fk = F.k(), m = (0.82 + Math.min(4, rung) * 0.06 + Math.min(3, lap) * 0.08) * fk;
  return { react: Math.round(clamp(b.react / m, 6, 36)), block: clamp(b.block * m, 0.05, 0.92), combo: clamp(b.combo * m, 0.1, 0.95), aggr: clamp(b.aggr * m, 0.2, 0.92),
    anti: clamp(b.anti * m, 0.05, 0.9), punish: clamp(b.punish * m, 0.1, 0.95), zone: b.zone, cool: Math.round(clamp(b.cool / m, 6, 36)) };
}
function buildLadder() {
  const others = FIGHTERS.map((_, i) => i).filter(i => i !== pick), r = rng((D.seed || 4242) * 7 + pick * 131 + lap * 17);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  if (!D.seed) { const z = others.indexOf(5); if (z >= 0) { others.splice(z, 1); others.push(5); } }
  return others;
}
const level = () => lap * 5 + rung + 1;

function makeFighter(i, alt, side) {
  const def = FIGHTERS[i], m = buildModel(def, alt); scene.add(m.root);
  return { def, idx: i, side, m, mv: moveSet(def), x: 0, y: 0, vx: 0, vy: 0, face: 1, hp: 1000 * def.hp, max: 1000 * def.hp, shown: 1, trail: 1, meter: 0, st: 'stand', t: 0,
    move: null, mt: 0, moveId: 0, conn: false, hitN: 0, lastHitT: -99, inv: 0, stun: 0, jug: 0, taken: 0, chainN: 0, proj: null, airUsed: false, armorUsed: false, countered: false,
    wins: 0, flash: 0, in: { l: false, r: false, u: false, d: false, blk: false, buf: [] }, ai: null, dirs: [] };
}
function disposeFighter(f) { if (f) { scene.remove(f.m.root); if (f.proj) killProj(f.proj, false); } }

// ---------------------------------------------------------------- input helpers
const relDir = f => { const i = f.in, fw = f.face > 0 ? i.r : i.l, bk = f.face > 0 ? i.l : i.r; return i.u ? 'up' : fw ? 'fwd' : bk ? 'back' : i.d ? 'down' : 'none'; };
const holdBack = f => (f.face > 0 ? f.in.l : f.in.r);
function press(f, k, dir) { f.in.buf.push({ k, dir: dir || null, t: frame }); if (f.in.buf.length > 6) f.in.buf.shift(); }
function takeBtn(f, allowed) {
  const b = f.in.buf; while (b.length && frame - b[0].t > 8) b.shift();
  for (let i = 0; i < b.length; i++) if (!allowed || allowed.includes(b[i].k)) return b.splice(i, 1)[0];
  return null;
}
const actionable = f => f.st === 'stand' || f.st === 'crouch';
function pickMove(f, b) {
  const k = b.k, air = f.y > 0.05;
  if (k === 'SUP') return f.meter >= 100 && !air ? f.mv.sup : null;
  if (air) return k === 'P' ? f.mv.jP : k === 'K' ? f.mv.jK : null;
  if (k === 'S') { const d = b.dir || relDir(f); const m = d === 'up' ? f.mv.sp[2] : d === 'fwd' ? f.mv.sp[1] : f.mv.sp[0]; if (m.proj && f.proj) return null; if (m.proj && f.mv.sup === m && f.proj) return null; return m; }
  if (k === 'P' && f.in.blk && !f.in.d) return f.mv.T;            // block + punch up close = throw (beats blocking)
  if (f.in.d) return k === 'P' ? f.mv.cP : f.mv.cK;
  return k === 'P' ? f.mv.P : f.mv.K;
}
function startMove(f, m, chained = false) {
  f.st = 'attack'; f.move = m; f.mt = 0; f.moveId++; f.conn = false; f.hitN = 0; f.lastHitT = -99; f.armorUsed = false; f.countered = false;
  f.chainN = chained ? f.chainN + 1 : 0;
  if (m.inv) f.inv = Math.max(f.inv, m.inv);
  if (m.super) { f.meter = 0; superT = 42; superWho = f; snd.superS(); ui.flash(0.45); ui.pop(m.name.toUpperCase() + '!', '#ffd23f', 30, 30); buzz(40); }
  else if (m.special) { f.meter = Math.min(100, f.meter + 3); if (f === P1 && !botOn) ui.pop(m.name, '#ffffff', 22, 32); }
  if (!m.air && !m.rise && !m.vx) f.vx = 0;
  snd.whoosh();
}

// ---------------------------------------------------------------- simulation
function stepF(f, o) {
  f.t++; if (f.inv > 0) f.inv--; if (f.flash > 0) f.flash--;
  const i = f.in;
  if ((actionable(f) || f.st === 'land' || f.st === 'block') && f.y <= 0) f.face = o.x >= f.x ? 1 : -1;
  switch (f.st) {
    case 'stand': case 'crouch': {
      const b = takeBtn(f);
      if (b) { const m = pickMove(f, b); if (m) { startMove(f, m); break; } }
      if (i.u) {
        const d = relDir({ ...f, in: { ...i, u: false } });
        f.st = 'jump'; f.t = 0; f.vy = f.def.jv; f.vx = d === 'fwd' ? f.face * f.def.jh : d === 'back' ? -f.face * f.def.jh * 0.9 : 0; f.airUsed = false; snd.jump(); dust(f.x, 4); break;
      }
      if (i.d) { f.st = 'crouch'; f.vx = 0; break; }
      f.st = 'stand';
      const fw = f.face > 0 ? i.r : i.l, bk = f.face > 0 ? i.l : i.r;
      f.vx = i.blk ? 0 : fw ? f.def.walk * f.face : bk ? -f.def.walk * 0.75 * f.face : 0;
      break;
    }
    case 'jump': if (!f.airUsed) { const b = takeBtn(f, ['P', 'K']); if (b) { const m = pickMove(f, b); if (m) { f.airUsed = true; startMove(f, m); } } } break;
    case 'attack': {
      const m = f.move; f.mt++;
      if (m.rise && f.mt === m.s) { f.vy = m.rise; f.vx = f.face * (m.vx || 0); }
      else if (m.vx && !m.rise && f.mt >= m.s && f.mt < m.s + m.a) f.vx = f.face * m.vx;
      else if (!m.air && !m.rise && f.y <= 0) f.vx *= 0.7;
      if ((m.proj) && f.mt === m.s) spawnProj(f, m);
      if (m.beam && f.mt === m.s) { snd.proj(); }
      if (m.wave && f.mt === m.s) { wave.visible = true; wave.userData.t = 0; wave.position.set(f.x, 0.1, 0.3); }
      if (f.conn && m.cancel && f.mt >= m.s) {
        const b = takeBtn(f, m.cancel);
        if (b) { const n = pickMove(f, b); if (n && (n !== m || (m === f.mv.P || m === f.mv.cP) && f.chainN < 2)) { startMove(f, n, true); break; } }
      }
      const end = m.s + m.a + m.r;
      if (f.mt >= end) {
        if (f.y <= 0) { f.st = i.d ? 'crouch' : 'stand'; f.move = null; }
        else if (m.air) { f.st = 'jump'; f.move = null; f.airUsed = true; }
      }
      break;
    }
    case 'hit': case 'block': f.vx *= 0.86; if (--f.stun <= 0) { f.st = 'stand'; } break;
    case 'land': f.vx = 0; if (--f.stun <= 0) f.st = 'stand'; break;
    case 'down': f.vx *= 0.8; if (f.t >= 26) { f.st = 'rise'; f.t = 0; f.inv = 20; } break;
    case 'rise': if (f.t >= 13) { f.st = 'stand'; f.inv = Math.max(f.inv, 3); } break;
    case 'win': case 'idle': f.vx = 0; break;
  }
  if (actionable(f) || f.st === 'jump') { f.taken = 0; f.jug = 0; }
  const airborne = f.y > 0 || f.vy > 0;
  if (airborne) { f.vy -= G; f.y += f.vy; if (f.y <= 0) { f.y = 0; f.vy = 0; land(f); } }
  else if (f.st === 'ko') f.vx *= 0.9;
  f.x = clamp(f.x + f.vx, -WALL, WALL);
}
function land(f) {
  if (f.st === 'jump' || (f.st === 'attack' && f.move && f.move.air)) { f.st = 'land'; f.stun = 4; f.move = null; dust(f.x, 4); }
  else if (f.st === 'attack' && f.move && f.move.rise) {
    const m = f.move;
    if (m.slam) { ring(f.x, 0.08, '#ffb3d9', 1.6, true); dust(f.x, 10); shake = Math.max(shake, 0.12); snd.thud(); }
    f.st = 'land'; f.stun = m.r; f.move = null;
  } else if (f.st === 'air') { f.st = 'down'; f.t = 0; f.vx *= 0.4; snd.thud(); dust(f.x, 8); shake = Math.max(shake, 0.08); }
  else if (f.st === 'ko') { snd.thud(); dust(f.x, 12); shake = Math.max(shake, 0.15); if (!f.bounced) { f.bounced = true; f.vy = 0.07; f.y = 0.001; } else f.vx *= 0.3; }
}
function hurtTop(d) { return d.y + (d.st === 'crouch' || (d.st === 'block' && d.in.d) || (d.st === 'attack' && d.move && (d.move === d.mv.cP || d.move === d.mv.cK)) ? 1.25 : 1.95); }
function checkHits(a, d) {
  const m = a.move; if (a.st !== 'attack' || !m || m.proj || m.counter) return;
  if (!(a.mt >= m.s && a.mt < m.s + m.a)) return;
  if (m.slam && a.vy > 0) return;
  const hits = m.hits || 1; if (a.hitN >= hits) return;
  if (a.hitN > 0 && a.mt - a.lastHitT < (m.iv || 99)) return;
  if (d.inv > 0 || d.st === 'down' || d.st === 'rise' || d.st === 'ko' || (d.st === 'air' && d.jug >= 3)) return;
  const hw = m.reach / 2, cx = m.wave ? a.x : a.x + a.face * (0.3 + hw), cy = a.y + m.hy, hh = m.hh || 0.35;
  if (Math.abs(cx - d.x) > hw + 0.42) return;
  if (cy - hh > hurtTop(d) || cy + hh < d.y) return;
  if (m.grab) {
    if (d.y > 0.05 || d.st === 'air' || d.st === 'hit') return;
    a.hitN = hits; a.conn = true; grabHit(a, d, m); return;
  }
  a.hitN++; a.lastHitT = a.mt;
  resolve(a, d, { ...m, kd: m.kd && (a.hitN >= hits) }, d.x - a.face * 0.35, clamp(cy, d.y + 0.3, hurtTop(d) - 0.1), false);
}
function resolve(a, d, m, px, py, isProj) {
  // counter stance (Calm Palm)
  if (d.st === 'attack' && d.move && d.move.counter && !d.countered && d.mt >= d.move.s && d.mt < d.move.s + d.move.a && m.lvl !== 'low') {
    d.countered = true; d.mt = d.move.s + d.move.a; d.face = a.x >= d.x ? 1 : -1;
    snd.counter(); ui.pop('COUNTER!', '#7bf1a8', 34, 30); spark(px, py, 10, ['#7bf1a8', '#ffffff']); ring(px, py, '#7bf1a8', 1.3);
    if (!isProj) applyHit(d, a, { dmg: d.move.counter.dmg, kd: 1, heavy: 1, launch: 0.15 }, a.x - d.face * 0.3, a.y + 1.2);
    return;
  }
  // armour (Shield Charge) eats one hit
  if (d.st === 'attack' && d.move && d.move.armor && !d.armorUsed && d.mt < d.move.s + d.move.a) {
    d.armorUsed = true; d.hp = Math.max(1, d.hp - Math.round(m.dmg * 0.4)); d.flash = 3; hitstop = 5; snd.block(); spark(px, py, 8, ['#c7ccd6', '#ffffff']); ring(px, py, '#c7ccd6', 1); a.conn = true; return;
  }
  const canBlock = ['stand', 'crouch', 'block', 'land'].includes(d.st) && d.y <= 0 && (d.in.blk || holdBack(d));
  const lowOK = m.lvl !== 'low' || d.in.d, highOK = m.lvl !== 'high' || !d.in.d;
  if (canBlock && lowOK && highOK) {
    d.st = 'block'; d.stun = m.bs || 10; d.vx = a.face * ((m.push || 0.06) + (m.special ? 0.03 : 0)); d.move = null;
    const chip = m.special ? Math.round(m.dmg * 0.12) : 0; if (chip) { d.hp = Math.max(0, d.hp - chip); if (d.hp <= 0) { applyHit(a, d, { ...m, dmg: 1 }, px, py, isProj); return; } }
    a.conn = true; a.meter = Math.min(100, a.meter + 3); d.meter = Math.min(100, d.meter + 4);
    hitstop = Math.max(hitstop, 4); snd.block(); spark(px, py, 5, ['#9fd8ff', '#ffffff'], 0.7); ring(px, py, '#9fd8ff', 0.7);
    if (Math.abs(d.x) >= WALL - 0.05 && !isProj) a.vx = -a.face * 0.06;
    return;
  }
  applyHit(a, d, m, px, py, isProj);
}
function applyHit(a, d, m, px, py, isProj) {
  const scale = Math.max(0.5, 1 - 0.1 * d.taken), dmg = Math.round(m.dmg * scale);
  d.hp = Math.max(0, d.hp - dmg); d.taken++; a.conn = true; d.flash = 4;
  a.meter = Math.min(100, a.meter + 6 + dmg / 25); d.meter = Math.min(100, d.meter + 4);
  const big = m.heavy || dmg >= 90;
  hitstop = Math.max(hitstop, big ? 9 : 6); shake = Math.max(shake, 0.05 + dmg / 1400); hype = Math.min(1, hype + dmg / 400);
  spark(px, py, big ? 12 : 7, big ? ['#ffd23f', '#ffffff', '#ff8c42'] : ['#ffffff', '#ffd23f'], big ? 1.4 : 1); ring(px, py, big ? '#ffd23f' : '#ffffff', big ? 1.3 : 0.9);
  (big ? snd.heavy : snd.light)(); if (a === P1 || d === P1) buzz(big ? 30 : 15);
  if (d.taken >= 2) showCombo(a, d.taken);
  if (d.proj && d.st !== 'attack') {}
  if (d.hp <= 0) { koF(d, a); return; }
  const air = d.y > 0.05 || d.st === 'air' || d.st === 'jump';
  if (m.kd || m.launch || air) { d.st = 'air'; d.t = 0; d.vy = m.launch || (air ? 0.12 : 0.13); d.y = Math.max(d.y, 0.01); d.vx = a.face * (m.kd ? 0.06 : 0.035); d.jug++; d.move = null; }
  else { d.st = 'hit'; d.stun = m.hs || 15; d.vx = a.face * (m.push || 0.06); d.move = null; }
  if (Math.abs(d.x) >= WALL - 0.05 && !isProj) a.vx = -a.face * 0.08;
}
function grabHit(a, d, m) {
  d.move = null; d.hp = Math.max(0, d.hp - m.dmg); d.taken++; d.flash = 6; a.meter = Math.min(100, a.meter + 10);
  hitstop = 12; shake = 0.2; snd.heavy(); ui.pop(m.name.toUpperCase() + '!', '#ffd23f', 28, 30);
  spark(d.x, 1.2, 14, ['#ffd23f', '#ff8c42', '#ffffff'], 1.3); ring(d.x, 1.0, '#ffd23f', 1.4);
  if (d.hp <= 0) { koF(d, a); return; }
  d.st = 'air'; d.t = 0; d.vy = 0.2; d.y = 0.01; d.vx = a.face * 0.07; d.jug = 3;
}
function koF(d, a) {
  d.st = 'ko'; d.t = 0; d.vy = 0.2; d.y = Math.max(0.01, d.y); d.vx = a.face * 0.1; d.move = null; d.bounced = false; d.hp = 0;
  slowT = 30; hitstop = 12; shake = 0.35; ui.flash(0.7); snd.ko(); buzz([60, 40, 90]);
  const p = new V3(d.x, d.y + 1.2, 0.3);
  spark(d.x, d.y + 1.2, 26, ['#ffd23f', '#ffffff', '#ff5d8f', '#7bf1a8'], 2);
  confetti(scene, p, 70); burst(scene, p, ['#ffd23f', '#ffffff'], 18, { shape: 'sphere', speed: 0.16, up: 0.12, size: 0.8 });
  hype = 1; endRound(a);
}

// ---------------------------------------------------------------- projectiles
const projGeo = {};
function projMesh(kind, color, r) {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, ...o });
  const add = (geo, mm, p = [0, 0, 0], ro = [0, 0, 0], s = [1, 1, 1]) => { const m = new THREE.Mesh(geo, mm); m.position.set(...p); m.rotation.set(...ro); m.scale.set(...s); m.castShadow = true; g.add(m); return m; };
  if (kind === 'glove') { add(new THREE.SphereGeometry(r, 16, 12), M(color), [0, 0, 0], [0, 0, 0], [1.1, 1, 1]); add(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.12, 12), M('#ffffff'), [-r * 0.9, 0, 0], [0, 0, Math.PI / 2]); add(new THREE.ConeGeometry(r * 0.55, 0.7, 12), M('#ffb703', { emissive: '#ff6a00', emissiveIntensity: 0.8 }), [-r - 0.4, 0, 0], [0, 0, Math.PI / 2]); }
  else if (kind === 'thorn') { for (const a of [-0.35, 0, 0.35]) add(new THREE.ConeGeometry(0.07, 0.45, 8), M(color), [0, a * 0.5, 0], [0, 0, -Math.PI / 2 + a]); add(new THREE.SphereGeometry(0.1, 10, 8), M('#ff6fae'), [-0.1, 0, 0]); }
  else if (kind === 'acorn' || kind === 'bigacorn') { const s = kind === 'bigacorn' ? 2.2 : 1; add(new THREE.SphereGeometry(0.17 * s, 14, 10), M('#c98a3c'), [0, -0.03 * s, 0], [0, 0, 0], [1, 1.2, 1]); add(new THREE.SphereGeometry(0.18 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#6b4423'), [0, 0.02 * s, 0]); add(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.1 * s, 6), M('#6b4423'), [0, 0.2 * s, 0]); if (s > 1) add(new THREE.TorusGeometry(0.5, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); }
  else if (kind === 'bubble') { add(new THREE.SphereGeometry(r, 20, 14), M(color, { transparent: true, opacity: 0.5, roughness: 0.05 })); add(new THREE.SphereGeometry(r * 0.2, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), [r * 0.35, r * 0.4, r * 0.6]); }
  else if (kind === 'pin') { add(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 14), M(color), [0, 0, 0], [0, 0, Math.PI / 2]); for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), M('#8f5a34'), [s * 0.34, 0, 0], [0, 0, Math.PI / 2]); }
  else { add(new THREE.IcosahedronGeometry(r, 0), M(color, { emissive: '#ffd23f', emissiveIntensity: 0.9, flatShading: true })); add(new THREE.SphereGeometry(r * 0.55, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' })); }
  scene.add(g); return g;
}
function spawnProj(f, m) {
  const p = m.proj, mesh = projMesh(p.kind, p.color, p.r);
  const o = { id: ++projId, owner: f, x: f.x + f.face * 0.75, y: f.y + 1.15, vx: p.vx * f.face, vy: p.vy || 0, g: p.g || 0, r: p.r, life: p.life, hitN: 0, hits: p.hits || 1, iv: p.iv || 0, last: -99, age: 0,
    m: { dmg: p.dmg, hs: p.hs, bs: p.bs, lvl: 'mid', push: 0.06, special: 1, kdEnd: p.kdEnd, heavy: p.dmg >= 85 }, mesh, kind: p.kind };
  mesh.position.set(o.x, o.y, 0); mesh.scale.x = f.face;
  f.proj = o; projs.push(o); snd.proj(); spark(o.x, o.y, 5, [p.color, '#ffffff'], 0.6);
}
function killProj(p, pop = true) {
  if (p.dead) return; p.dead = true; scene.remove(p.mesh); if (p.owner.proj === p) p.owner.proj = null;
  if (pop) { spark(p.x, p.y, 8, ['#ffffff', '#ffd23f'], 0.9); ring(p.x, p.y, '#ffffff', 0.8); }
}
function stepProjs() {
  for (const p of projs) {
    if (p.dead) continue;
    p.age++; p.vy -= p.g; p.x += p.vx; p.y += p.vy; p.life--;
    p.mesh.position.set(p.x, p.y, 0);
    if (p.kind === 'pin' || p.kind === 'acorn' || p.kind === 'bigacorn') p.mesh.rotation.z -= 0.35 * Math.sign(p.vx);
    else if (p.kind === 'zap') p.mesh.rotation.set(p.age * 0.3, p.age * 0.2, 0);
    else if (p.kind === 'bubble') { const w = 1 + Math.sin(p.age * 0.3) * 0.06; p.mesh.scale.set(w, 2 - w, 1); }
    if (p.age % 3 === 0) spark(p.x - p.vx * 3, p.y, 1, ['#ffffff'], 0.3);
    if (p.life <= 0 || Math.abs(p.x) > WALL + 1.2 || p.y < 0.12) { killProj(p); continue; }
    const t = p.owner === P1 ? P2 : P1;
    if (phase !== 'fight') continue;
    if (t.inv > 0 || ['down', 'rise', 'ko'].includes(t.st) || (t.st === 'air' && t.jug >= 3)) continue;
    if (Math.abs(p.x - t.x) < p.r + 0.4 && p.y - p.r < hurtTop(t) && p.y + p.r > t.y) {
      if (p.age - p.last < p.iv) continue; p.last = p.age; p.hitN++;
      const last = p.hitN >= p.hits;
      resolve(p.owner, t, { ...p.m, kd: p.m.kdEnd && last }, p.x, p.y, true);
      if (last || t.st === 'block') killProj(p);
    }
  }
  // clash
  const a = P1 && P1.proj, b = P2 && P2.proj;
  if (a && b && Math.abs(a.x - b.x) < a.r + b.r && Math.abs(a.y - b.y) < a.r + b.r + 0.2) { killProj(a); killProj(b); snd.block(); hitstop = 4; }
  projs = projs.filter(p => !p.dead);
}
function stepBeam(a, d) {
  const m = a.move;
  const on = a.st === 'attack' && m && m.beam && a.mt >= m.s && a.mt < m.s + m.a;
  beam.visible = on;
  if (on) { const len = m.reach; beam.scale.set(1 + Math.sin(frame * 0.9) * 0.25, len, 1 + Math.sin(frame * 0.9) * 0.25); beam.position.set(a.x + a.face * (0.4 + len / 2), a.y + m.hy, 0.2); }
}

// ---------------------------------------------------------------- CPU / bot brain (same controls as a player)
const snap = o => ({ x: o.x, y: o.y, st: o.st, mv: o.move, mt: o.mt, id: o.moveId, vy: o.vy, proj: o.proj && !o.proj.dead ? { x: o.proj.x, y: o.proj.y, vx: o.proj.vx, id: o.proj.id } : null });
function think(f, o, P) {
  const A = f.ai || (f.ai = { hist: [], plan: 'idle', n: 0, tid: null, tre: null, low: false, chain: 0, chainFor: -1, punFor: -1, aa: 0 });
  A.hist.push(snap(o)); if (A.hist.length > 48) A.hist.shift();
  const s = A.hist[Math.max(0, A.hist.length - 1 - P.react)];
  const i = f.in; i.l = i.r = i.u = i.d = i.blk = false;
  const dx = s.x - f.x, dist = Math.abs(dx), T = dx >= 0 ? 'r' : 'l', W = dx >= 0 ? 'l' : 'r', R = Math.random;
  if (A.aa > 0) A.aa--;
  if (f.st === 'attack') {
    const m = f.move;
    if (m === f.mv.cP) i.d = true;
    if (f.conn && A.chainFor !== f.moveId) {
      A.chainFor = f.moveId;
      if (R() < P.combo) {
        if (m === f.mv.P) { if (A.chain++ < 1) press(f, 'P'); else press(f, 'K'); }
        else if (m === f.mv.K && (P.kd === undefined || R() < P.kd || o.hp < 260)) press(f, f.meter >= 100 && R() < 0.7 ? 'SUP' : 'S', f.mv.sp[1].grab ? (f.mv.sp[2].rise ? 'up' : null) : 'fwd');
        else if (m === f.mv.cP) { i.d = true; press(f, 'K'); }
      }
    }
    return;
  }
  A.chain = 0;
  if (f.st === 'jump') { if (Math.abs(o.x - f.x) < 1.7 && f.vy < 0.03 && !f.airUsed) press(f, R() < 0.6 ? 'K' : 'P'); return; }
  if (f.st === 'block') { i[W] = true; i.blk = true; i.d = A.low; return; }
  if (!actionable(f) && f.st !== 'land') return;
  const om = s.mv, attacking = s.st === 'attack' && om && !om.proj && !om.counter && s.mt < om.s + om.a + 1;
  const reach = om ? (om.vx || om.rise ? 3.0 : om.wave ? om.reach / 2 + 1 : om.reach + 1.0) : 0;
  const pr = s.proj, projIn = pr && (pr.vx > 0) === (f.x > pr.x) && Math.abs(f.x - pr.x) < 3.4;
  if ((attacking && dist < reach) || projIn) {
    const id = projIn ? 'p' + pr.id : 'm' + s.id;
    if (A.tid !== id) { A.tid = id; A.tre = R() < P.block ? (om && om.grab && !projIn ? 'jumpback' : 'block') : projIn && R() < 0.4 ? 'jump' : 'none'; A.low = !!(om && om.lvl === 'low' && R() < P.block + 0.2); if (om && om.lvl === 'high') A.low = false; }
    if (A.tre === 'block') { i[W] = true; i.blk = true; i.d = A.low; return; }
    if (A.tre === 'jump') { A.tre = 'none'; i.u = true; i[T] = true; return; }
    if (A.tre === 'jumpback') { A.tre = 'none'; i.u = true; i[W] = true; return; }
  }
  const airIn = (s.st === 'jump' || (s.st === 'attack' && s.y > 0.3 && om && om.air)) && dist < 2.6 && s.y > 0.35;
  if (airIn && A.aa === 0) { A.aa = 30; if (R() < P.anti) { if (f.mv.sp[2].rise) press(f, 'S', 'up'); else press(f, 'P'); return; } }
  if (s.st === 'attack' && om && s.mt >= om.s + om.a && dist < 1.6 && A.punFor !== s.id) { A.punFor = s.id; if (R() < P.punish) { press(f, 'P'); return; } }
  if ((s.st === 'hit' || s.st === 'block') && dist < 1.4 && A.punFor !== 'h' + s.id && R() < P.aggr) { A.punFor = 'h' + s.id; }
  if ((s.st === 'block' || (s.st === 'stand' && Math.abs(s.x - f.x) < 1.0 && R() < 0.3)) && dist < 1.35 && frame - (A.thT || 0) > 24 && R() < P.aggr * 0.6) { A.thT = frame; i.blk = true; press(f, 'P'); return; }
  if (f.meter >= 100 && dist < (f.mv.sup.beam ? 5 : f.mv.sup.proj ? 4 : 1.6) && R() < 0.05 + P.aggr * 0.05) { press(f, 'SUP'); return; }
  if (A.n > 0) {
    A.n--;
    if (A.plan === 'fwd') i[T] = true; else if (A.plan === 'back') i[W] = true; else if (A.plan === 'guard') { i[W] = true; i.blk = true; } else if (A.plan === 'duck') i.d = true;
    return;
  }
  const r = R(), ag = P.aggr, sp = f.mv.sp, hasProj = P.zone >= 0 && sp[0].proj && !f.proj;
  const plan = (p, n) => { A.plan = p; A.n = n; };
  if (s.st === 'down' || s.st === 'rise') { plan(dist > 1.3 ? 'fwd' : 'guard', 10); return; }
  if (dist > 3.3 && ag > 0.9) plan('fwd', 10);
  else if (dist > 3.3) {
    if (hasProj && r < 0.22 + P.zone * 0.4) press(f, 'S');
    else if (r < 0.82) plan('fwd', 14 + R() * 22 | 0);
    else if (r < 0.9) { i.u = true; i[T] = true; }
    else plan('idle', 10);
  } else if (dist > 1.5) {
    if (ag > 0.9) { if (dist < 1.95 && r < 0.3) press(f, 'K'); else plan('fwd', 6); }
    else if (r < ag * 0.25 && dist < 1.95) press(f, 'K');
    else if (r < ag * 0.38 && sp[1].vx && !sp[1].grab && dist < 2.8) press(f, 'S', 'fwd');
    else if (r < 0.2 + ag * 0.45) plan('fwd', 8 + R() * 14 | 0);
    else if (r < 0.62 && hasProj) press(f, 'S');
    else if (r < 0.72) { i.u = true; i[T] = true; }
    else plan(R() < 0.5 ? 'guard' : 'back', 10 + R() * 10 | 0);
  } else {
    if (r < ag * 0.42) press(f, 'P');
    else if (r < ag * 0.55) { i.d = true; press(f, 'K'); }
    else if (r < ag * 0.66 && sp[1].grab) press(f, 'S', 'fwd');
    else if (r < ag * 0.66 && sp[2].grab) press(f, 'S', 'up');
    else if (r < ag * 0.8) press(f, 'K');
    else if (ag > 0.9) press(f, 'P');
    else if (r < 0.9) plan('guard', 12 + R() * 10 | 0);
    else { i.u = true; i[W] = true; }
  }
  if (A.n === 0) A.n = P.cool + (R() * 6 | 0), A.plan = A.plan === 'idle' ? 'idle' : 'hold';
}

// ---------------------------------------------------------------- human controls (touch + keyboard)
const H = { l: false, r: false, u: false, d: false, blk: false }, K = { l: false, r: false, u: false, d: false, blk: false };
const pad = $('pad'), knob = $('knob');
let stickId = null;
function stickAt(e) {
  const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const L = Math.hypot(dx, dy), max = r.width * 0.36; if (L > max) { dx *= max / L; dy *= max / L; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  H.l = dx < -16; H.r = dx > 16; H.u = dy < -max * 0.55; H.d = dy > max * 0.5;
}
pad.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); stickId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (x) {} stickAt(e); audioWake(); });
pad.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickAt(e); });
const stickOff = e => { if (e.pointerId !== stickId) return; stickId = null; H.l = H.r = H.u = H.d = false; knob.style.transform = ''; };
pad.addEventListener('pointerup', stickOff); pad.addEventListener('pointercancel', stickOff);
const canAct = () => state === 'play' && phase === 'fight' && P1 && !botOn;
function bindBtn(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (x) {} audioWake(); down(e); });
  const off = e => { el.classList.remove('down'); up && up(e); };
  el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
}
bindBtn('bP', () => canAct() && press(P1, 'P'));
bindBtn('bK', () => canAct() && press(P1, 'K'));
bindBtn('bB', () => { H.blk = true; }, () => { H.blk = false; });
bindBtn('bU', () => canAct() && press(P1, 'SUP'));
let spDown = null, spTimer = 0;
const fireSpecial = dir => { clearTimeout(spTimer); spDown = null; if (canAct()) press(P1, 'S', dir); };
bindBtn('bS', e => { spDown = { x: e.clientX, y: e.clientY }; clearTimeout(spTimer); spTimer = setTimeout(() => spDown && fireSpecial(null), 260); }, e => {
  if (!spDown) return; const dx = e.clientX - spDown.x, dy = e.clientY - spDown.y;
  if (Math.hypot(dx, dy) > 26) { const fw = P1 ? (dx > 0) === (P1.face > 0) : true; fireSpecial(Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'up' : null) : fw ? 'fwd' : null); }
  else fireSpecial(null);
});
const KEYMAP = { a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', w: 'u', arrowup: 'u', ' ': 'u', s: 'd', arrowdown: 'd', u: 'blk', shift: 'blk' };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); audioWake();
  if (KEYMAP[k]) { K[KEYMAP[k]] = true; e.preventDefault(); }
  if (e.repeat) return;
  if (state === 'ready' && !$('sel').hidden && (k === 'enter' || k === ' ')) { goFight(); return; }
  if (!canAct()) return;
  if (k === 'j' || k === 'k') press(P1, ...motion(k === 'j' ? 'P' : 'K'));
  else if (k === 'l') press(P1, 'S');
  else if (k === 'i') press(P1, 'SUP');
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (KEYMAP[k]) K[KEYMAP[k]] = false; });
addEventListener('blur', () => { for (const k in K) K[k] = false; for (const k in H) H[k] = false; });
// motion inputs from the last ~20 frames of stick positions (numpad notation, relative to facing)
const numpad = f => { const i = f.in, fw = f.face > 0 ? i.r : i.l, bk = f.face > 0 ? i.l : i.r; const v = i.u ? 2 : i.d ? 0 : 1, h = fw ? 2 : bk ? 0 : 1; return [[1, 2, 3], [4, 5, 6], [7, 8, 9]][v][h]; };
function motion(btn) {
  const seq = P1.dirs.filter(d => frame - d.f < 22).map(d => d.c), has = (...xs) => { let j = 0; for (const c of seq) if (c === xs[j]) j++; return j >= xs.length; };
  if (has(6, 2, 3) || has(6, 2, 6)) return ['S', 'up'];
  if (has(2, 3, 6) || has(2, 6)) return ['S', null];
  if (has(2, 1, 4) || has(2, 4)) return ['S', 'fwd'];
  return [btn];
}
let audioOK = false; function audioWake() { if (!audioOK) { audioOK = true; tone(1, 0.01, 'sine', 0.0001); } }

// ---------------------------------------------------------------- HUD
const hud = { n1: $('n1'), n2: $('n2'), hp1: $('hp1'), hp2: $('hp2'), tr1: $('tr1'), tr2: $('tr2'), sm1: $('sm1'), sm2: $('sm2'), pp1: $('pp1'), pp2: $('pp2'), clock: $('clock'), ann: $('ann'), combo: $('combo'), bU: $('bU') };
function announce(html, cls = 'go') { const a = hud.ann; a.className = ''; a.innerHTML = html; void a.offsetWidth; a.className = cls; }
let comboT = 0;
function showCombo(a, n) { const c = hud.combo; c.innerHTML = `${n} HITS!<small>${a === P1 ? 'YOUR COMBO' : a.def.name}</small>`; c.style.left = a === P1 ? '16px' : 'auto'; c.style.right = a === P1 ? 'auto' : '16px'; c.style.textAlign = a === P1 ? 'left' : 'right'; c.classList.add('on'); comboT = 70; if (n >= 3 && a === P1) note(72 + Math.min(n, 8) * 2, 0.15, 0.08); }
function updHud() {
  if (!P1) return;
  for (const [f, hp, tr, sm, pp] of [[P1, hud.hp1, hud.tr1, hud.sm1, hud.pp1], [P2, hud.hp2, hud.tr2, hud.sm2, hud.pp2]]) {
    const v = f.hp / f.max; f.shown = v; f.trail = f.trail > v ? Math.max(v, f.trail - 0.006) : v;
    hp.style.width = v * 100 + '%'; tr.style.width = f.trail * 100 + '%'; hp.classList.toggle('low', v < 0.25);
    sm.firstChild.style.width = f.meter + '%'; sm.classList.toggle('full', f.meter >= 100);
    pp.children[0].classList.toggle('on', f.wins >= 1); pp.children[1].classList.toggle('on', f.wins >= 2);
  }
  hud.clock.textContent = Math.max(0, Math.ceil(clock)); hud.clock.classList.toggle('hurry', clock <= 10);
  hud.bU.classList.toggle('ready', P1.meter >= 100);
  if (comboT > 0 && --comboT === 0) hud.combo.classList.remove('on');
}
const showPlayHud = on => { for (const id of ['hud', 'ctl', 'stagebar', 'keys']) $(id).classList.toggle('off', !on); };

// ---------------------------------------------------------------- fight flow
function startFight() {
  $('sel').hidden = true; selModel && (scene.remove(selModel.root), selModel = null);
  ladder = buildLadder(); if (rung >= ladder.length) rung = 0;
  disposeFighter(P1); disposeFighter(P2); projs.forEach(p => killProj(p, false)); projs = [];
  setArena(rung + lap);
  P1 = makeFighter(pick, alts[pick] && altOK(pick), 0); P2 = makeFighter(ladder[rung], false, 1);
  cpuP = cpuProfile(); recorded = false; roundNo = 1; state = 'play'; fightT0 = performance.now();
  hud.n1.textContent = P1.def.name; hud.n2.textContent = P2.def.name;
  $('stagebar').textContent = `${D.seed ? 'DAILY · ' : ''}STAGE ${rung + 1}/${ladder.length} · ${diff.toUpperCase()} · ${arena.A.name.toUpperCase()}`;
  showPlayHud(true); B.start(); music.play(arenaIdx, 1);
  startRound();
}
function startRound() {
  for (const [f, x] of [[P1, -1.6], [P2, 1.6]]) Object.assign(f, { x, y: 0, vx: 0, vy: 0, face: x < 0 ? 1 : -1, hp: f.max, trail: 1, st: 'stand', t: 0, move: null, inv: 0, stun: 0, jug: 0, taken: 0, flash: 0, bounced: false, ai: null, dirs: [] }), f.in.buf = [];
  projs.forEach(p => killProj(p, false)); projs = []; dizzy.visible = false; beam.visible = false;
  clock = ROUND_T; clockF = 0; phase = 'intro'; phaseT = 0; roundWinner = null; hype = 0.4;
  camX = 0; camD = 9;
}
function endRound(winner) {
  if (phase !== 'fight') return;
  phase = 'ko'; phaseT = 0; roundWinner = winner;
  if (winner) winner.wins++;
  setTimeout(() => announce(winner ? 'K.O.!' : 'TIME!', 'hold'), 120);
}
function timeUp() {
  const a = P1.hp / P1.max, b = P2.hp / P2.max, w = a > b ? P1 : b > a ? P2 : null;
  phase = 'fight'; endRound(w); snd.bell(); announce('TIME!', 'hold');
  if (w) { const l = w === P1 ? P2 : P1; l.st = 'hit'; l.stun = 999; }
}
function endMatch() {
  const won = P1.wins >= 2;
  phase = 'end'; state = won ? 'won' : 'lost';
  const ms = performance.now() - fightT0, opp = P2.def.name;
  if (!recorded) { recorded = true; F.level(won, won ? 1 : P1.wins / 2); }
  if (won) {
    const pts = diff === 'hard' ? 2 : 1, total = S.get('pts', 0) + pts; S.set('pts', total);
    const wb = winsBy(); wb[pick]++; S.set('winsBy', wb);
    B.submit(pts, { ms });
    rung++; let champ = false;
    if (rung >= ladder.length) { champ = true; rung = 0; lap++; S.set('cleared', S.get('cleared', 0) + 1); }
    S.set(rungKey, rung); S.set(loopKey, lap);
    D.won(total, 'won fights for');
    if (D.beaten(total) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 40, 26); confetti(scene, new V3(P1.x, 2, 0.5), 80); }
    ui.els.win.querySelector('h1').textContent = champ ? 'CHAMPION!' : 'YOU WIN!';
    ui.win(champ ? `${ladder.length}/${ladder.length}` : `${rung}/${ladder.length}`, champ ? (S.get('cleared', 0) === 1 && pick !== 5 ? 'Ladder cleared! ZAPPO unlocked 🐙' : `Ladder cleared! Lap ${lap + 1} is tougher.`) : `Beat ${opp} · +${pts} win${pts > 1 ? 's' : ''} · next: ${FIGHTERS[ladder[rung]].name}`);
    if (wb[pick] === 3) setTimeout(() => ui.pop('NEW COLOURS UNLOCKED!', '#7bf1a8', 26, 40), 900);
    sfx.win(); confetti(scene, new V3(P1.x, 2.2, 0.5), 90);
  } else {
    ui.lose('K.O.!', `${opp} wins this one · tap for a rematch`);
    sfx.fail();
  }
  music.level(0.5);
}
function nextRoundOrEnd() {
  if (P1.wins >= 2 || P2.wins >= 2) { endMatch(); return; }
  roundNo++; startRound();
}

// ---------------------------------------------------------------- select screen
let selIdx = pick, selModel = null, selSpin = 0;
function openSelect() {
  state = 'ready'; phase = 'select'; showPlayHud(false);
  disposeFighter(P1); disposeFighter(P2); P1 = P2 = null; projs = [];
  setArena(rung + lap); music.play(arenaIdx, 0.55);
  $('sel').hidden = false; selIdx = pick; renderSel();
}
function renderSel() {
  const d = FIGHTERS[selIdx], ok = unlocked(selIdx);
  $('selSub').textContent = `${D.seed ? 'Daily ladder' : 'Arcade ladder'} · ${diff[0].toUpperCase() + diff.slice(1)} · ${S.get('pts', 0)} win points`;
  $('sName').textContent = d.name; $('sStyle').textContent = d.style;
  $('sBlurb').textContent = ok ? d.blurb : 'Clear the arcade ladder once to unlock this fighter.';
  $('sStats').innerHTML = ['POWER', 'SPEED', 'GUARD'].map((n, i) => `<div>${n}<i>${[1, 2, 3, 4, 5].map(k => `<b class="${k <= d.stats[i] ? 'on' : ''}"></b>`).join('')}</i></div>`).join('');
  $('sMoves').innerHTML = [['SP', d.sp[0].name], ['→ SP', d.sp[1].name], ['↑ SP', d.sp[2].name], ['⚡', d.sup.name]].map(([a, b]) => `<li><em>${a}</em>${b}</li>`).join('');
  $('grid').innerHTML = FIGHTERS.map((f, i) => `<button data-i="${i}" aria-pressed="${i === selIdx}" class="${unlocked(i) ? '' : 'lock'}"><span>${f.icon}</span>${f.name}<small>${f.style}</small></button>`).join('');
  $('grid').querySelectorAll('button').forEach(b => b.onclick = () => { selIdx = +b.dataset.i; sfx.pick(selIdx); renderSel(); });
  const alt = $('sAlt'); alt.disabled = !altOK(selIdx); alt.textContent = altOK(selIdx) ? (alts[selIdx] ? '🎨 Alt colours' : '🎨 Classic') : '🎨 3 wins';
  $('sMute').textContent = music.muted ? '🔇' : '🔊';
  $('sGo').disabled = !ok;
  if (selModel) scene.remove(selModel.root);
  selModel = buildModel(d, alts[selIdx] && altOK(selIdx)); scene.add(selModel.root); selSpin = 0;
}
$('sAlt').onclick = () => { if (!altOK(selIdx)) return; alts[selIdx] = alts[selIdx] ? 0 : 1; S.set('alts', alts); renderSel(); };
$('sMute').onclick = () => { music.toggle(); renderSel(); };
function goFight() {
  if (!unlocked(selIdx)) return;
  if (selIdx !== pick) { pick = selIdx; S.set('pick', pick); rung = 0; lap = 0; S.set(rungKey, 0); S.set(loopKey, 0); }
  sfx.tap(); audioWake(); startFight();
}
$('sGo').onclick = goFight;
['pointerdown', 'touchstart'].forEach(t => $('sel').addEventListener(t, e => e.stopPropagation()));

ui.onTap(w => { audioWake(); if (w === 'start') openSelect(); else startFight(); });

// ---------------------------------------------------------------- main tick (60 Hz fixed)
function tick() {
  frame++;
  if (!P1) return;
  if (slowT > 0) slowT--;
  if (superT > 0) { superT--; $('dim').classList.toggle('on', superT > 0); return; }
  if (hitstop > 0) { hitstop--; return; }
  // inputs
  if (phase === 'fight') {
    if (botOn) think(P1, P2, BOTP);
    else { const i = P1.in; i.l = H.l || K.l; i.r = H.r || K.r; i.u = H.u || K.u; i.d = H.d || K.d; i.blk = H.blk || K.blk; }
    think(P2, P1, cpuP);
    const c = numpad(P1); if (!P1.dirs.length || P1.dirs[P1.dirs.length - 1].c !== c) { P1.dirs.push({ c, f: frame }); if (P1.dirs.length > 12) P1.dirs.shift(); }
  } else for (const f of [P1, P2]) { const i = f.in; i.l = i.r = i.u = i.d = i.blk = false; i.buf.length = 0; }
  stepF(P1, P2); stepF(P2, P1);
  // push boxes (jumps can cross over)
  const ghost = f => f.st === 'attack' && f.move && f.move.ghost && f.mt < f.move.s + f.move.a;
  if (!ghost(P1) && !ghost(P2) && P1.y < 1.1 && P2.y < 1.1 && !['down', 'ko'].includes(P1.st) && !['down', 'ko'].includes(P2.st)) {
    const dx = P2.x - P1.x, min = P1.def.w + P2.def.w;
    if (Math.abs(dx) < min) {
      const s = dx >= 0 ? 1 : -1, push = (min - Math.abs(dx)) / 2; P1.x -= s * push; P2.x += s * push;
      if (Math.abs(P1.x) > WALL) { P1.x = Math.sign(P1.x) * WALL; P2.x = P1.x + s * min; }
      if (Math.abs(P2.x) > WALL) { P2.x = Math.sign(P2.x) * WALL; P1.x = P2.x - s * min; }
    }
  }
  if (Math.abs(P2.x - P1.x) > MAXSEP) { const mid = (P1.x + P2.x) / 2, s = Math.sign(P2.x - P1.x); P1.x = mid - s * MAXSEP / 2; P2.x = mid + s * MAXSEP / 2; }
  if (phase === 'fight') { checkHits(P1, P2); checkHits(P2, P1); } stepProjs();
  stepBeam(P1, P2); if (!beam.visible) stepBeam(P2, P1);
  if (wave.visible) { wave.userData.t = (wave.userData.t || 0) + 1; const s = 0.4 + wave.userData.t * 0.12; wave.scale.set(s, s, s); wave.material.opacity = Math.max(0, 0.8 - wave.userData.t / 22); if (wave.userData.t > 22) wave.visible = false; }
  // phases
  phaseT++;
  if (phase === 'intro') {
    if (phaseT === 1) { announce(`ROUND ${roundNo}<small>${roundNo === 1 ? `${P1.def.name} vs ${P2.def.name}` : roundNo === 3 ? 'FINAL ROUND' : ''}</small>`); snd.bell(); }
    if (phaseT === 58) { announce('FIGHT!'); tone(220, 0.25, 'sawtooth', 0.08, 2); buzz(20); }
    if (phaseT >= 78) { phase = 'fight'; phaseT = 0; }
  } else if (phase === 'fight') {
    if (++clockF >= 60) { clockF = 0; clock--; if (clock <= 5 && clock > 0) tone(880, 0.06, 'square', 0.05, 1); if (clock <= 0) timeUp(); }
    if (D.beat && !beatenShown && D.beaten(S.get('pts', 0))) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 40, 26); confetti(scene, new V3(P1.x, 2, 0.5), 80); }
  } else if (phase === 'ko') {
    const w = roundWinner, l = w === P1 ? P2 : w === P2 ? P1 : null;
    if (phaseT === 62 && w) { w.st = 'win'; w.t = 0; w.move = null; if (w === P1) sfx.win(); }
    if (l && l.y <= 0 && phaseT > 40) { dizzy.visible = true; }
    if (phaseT >= 108) { dizzy.visible = false; nextRoundOrEnd(); }
  }
}

// ---------------------------------------------------------------- camera + render
let camX = 0, camD = 9, camTX = 0;
const look = new V3();
function updCam(dt, t) {
  const aspect = innerWidth / innerHeight, phone = aspect < 0.8, tanV = Math.tan(camera.fov * Math.PI / 360);
  let tx, d, gf = phone ? 0.58 : 0.74, ly;
  if (phase === 'select' && selModel) {
    d = phone ? 8 : 7;
    const gfS = phone ? 0.45 : 0.72; ly = (gfS - 0.5) * 2 * d * tanV;  // feet at gfS of screen height
    camD = lerp(camD, d, 0.08 * dt); camX = lerp(camX, phone ? 0 : 2.5, 0.1 * dt);
    camera.position.set(camX, ly + camD * 0.06, camD); look.set(camX, ly, 0); camera.lookAt(look);
    followLight(new V3(0, 0, 0)); return;
  }
  if (!P1) { camera.position.set(0, 2, 10); camera.lookAt(0, 1.5, 0); return; }
  const mid = (P1.x + P2.x) / 2, sep = Math.abs(P1.x - P2.x);
  d = clamp((sep / 2 + (phone ? 1.7 : 1.9)) / (tanV * aspect), phone ? 10 : 7, phone ? 17 : 12);
  tx = mid;
  if (superT > 0 && superWho) { d *= 0.8; tx = superWho.x; }
  else if (slowT > 0) d *= 0.86;
  camD = lerp(camD, d, 0.07 * dt); camX = lerp(camX, tx, 0.12 * dt);
  ly = (gf - 0.5) * 2 * camD * tanV;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  camera.position.set(camX + sx, ly + 1.0 + camD * 0.11 + sy, camD); look.set(camX + sx * 0.5, ly + 1.0 + sy * 0.5, 0); camera.lookAt(look);
  shake *= Math.pow(0.86, dt);
  followLight(new V3(camX, 0, 0));
}
let lastT = 0, acc = 0;
loop((dt, t) => {
  acc += dt * (slowT > 0 ? 0.35 : 1);
  let n = 0; while (acc >= 1 && n < 4) { acc -= 1; n++; tick(); }
  if (n === 4) acc = 0;
  const fdt = Math.min(2.5, dt);
  if (P1) { for (const f of [P1, P2]) { f.m.root.position.set(f.x, f.y, 0); animate(f.m, f, t, fdt); } }
  if (selModel && phase === 'select') {
    selSpin += 0.012 * fdt; selModel.root.position.set(0, 0, 0);
    const fake = { st: 'win', move: null, mt: 0, face: 1, vx: 0, y: 0, t: 0, flash: 0, meter: 0, in: {} };
    animate(selModel, fake, t, fdt); selModel.rig.rotation.y = Math.sin(selSpin) * 0.8 + 0.2;
  }
  if (dizzy.visible) {
    const l = roundWinner === P1 ? P2 : P1; if (l) { dizzy.children.forEach((s, i) => { const a = t * 4 + i * 2.09; s.position.set(l.x + Math.cos(a) * 0.45 - l.face * 0.6, 0.75 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.45); s.rotation.z = t * 5; }); }
  }
  hype = Math.max(0.15, hype - 0.004 * fdt);
  if (arena) arena.update(t, hype);
  updSparks(fdt); updRings(fdt); updCam(fdt, t); updHud();
});
setArena(0);
camera.position.set(0, 2.2, 10); camera.lookAt(0, 1.4, 0);
// a demo pair stands on the title screen behind the start card
(() => { const a = buildModel(FIGHTERS[0]), b = buildModel(FIGHTERS[1]); a.root.position.set(-1.3, 0, 0); b.root.position.set(1.3, 0, 0); scene.add(a.root, b.root);
  const fa = { st: 'stand', face: 1, vx: 0, y: 0, t: 0, flash: 0, meter: 0, in: {} }, fb = { ...fa, face: -1, in: {} };
  const iv = setInterval(() => { if (phase !== 'none') { scene.remove(a.root, b.root); clearInterval(iv); return; } const t = performance.now() / 1000; animate(a, fa, t, 1); animate(b, fb, t, 1); }, 16);
  P1 = null; })();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level(); }, get score() { return S.get('pts', 0); },
  get phase() { return phase; }, get dbg() { return { P1, P2, frame, hitstop, superT, slowT }; }, get p1() { return P1 && { hp: P1.hp, wins: P1.wins, st: P1.st }; }, get p2() { return P2 && { hp: P2.hp, wins: P2.wins, st: P2.st }; },
  bot() {
    botOn = true;
    if (state === 'ready' && phase === 'select') { selIdx = unlocked(pick) ? pick : 0; goFight(); }
    else if (state === 'ready' && phase === 'none') { ui.els.start.classList.add('hc-hidden'); openSelect(); }
  },
};

// Zoomburst: Street Racing. Arcade street racer: 5 CPU rivals on the same physics, drift + nitro, ramps, cones, traffic,
// a career of events, free races, a daily seeded time attack and a garage (cars, upgrades, paint) paid with race cash.
import { THREE, cine } from './kit/cine.js';
import { createUI, store, buzz, confetti, updateParticles, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { TRACKS, THEMES, Track, W, buildWorld, skyEnv, sunDir, toon, outlineMat, fin } from './world.js';
import { MODELS, TRAFFIC, PAINTS, FINISHES, RIMS, LIVERIES, makeCar, WheelPool } from './cars.js';
import { Puffs, Sparks, Skids, SpeedLines, radialBlur } from './fx.js';
import { makeAudio } from './audio.js';

const NAME = 'Zoomburst: Street Racing', KEY = 'zoomburst';
const ui = createUI({ title: 'ZOOM<em>BURST</em>', hint: 'Tap anywhere to race', hand: '', progress: false, score: false });
const D = daily(KEY, ui, { name: NAME });
const F = flow(KEY);
const B = board({ game: 'zoomburst', label: 'Race score', limits: { maxRun: 40000, maxPerSec: 900 }, corner: 'tl' });
const ST = store(KEY), A = makeAudio();
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const MODEL = Object.fromEntries(MODELS.map(m => [m.id, m]));
document.body.classList.add('zb');
ui.els.win.querySelector('p').style.display = 'none';

// ---------------------------------------------------------------- save
const save = {
  cash: ST.get('cash', 0), owned: ST.get('owned', ['pip']), car: ST.get('car', 'pip'), tune: ST.get('tune', {}), looks: ST.get('looks', {}),
  event: ST.get('event', 0), best: ST.get('best', {}), steer: ST.get('steer', 'buttons'), mute: ST.get('mute', false),
};
const persist = () => { for (const k of Object.keys(save)) ST.set(k, save[k]); };
const defLook = id => ({ paint: PAINTS[MODELS.findIndex(m => m.id === id) * 2 % PAINTS.length][1], finish: 0, rim: RIMS[0][1], livery: 3, num: 7, accent: '#ffffff' });
const lookOf = id => save.looks[id] || (save.looks[id] = defLook(id));
const tuneOf = id => save.tune[id] || (save.tune[id] = { e: 0, n: 0, h: 0 });
function statsFor(id, t) { const m = MODEL[id]; t = t || tuneOf(id); return { top: m.top * (1 + 0.035 * t.e), acc: m.acc * (1 + 0.06 * t.e), hand: m.hand * (1 + 0.045 * t.h), nos: m.nos * (1 + 0.12 * t.n) }; }
A.mute(save.mute);

// ---------------------------------------------------------------- renderer, scene, post
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const lite = isTouch && Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.domElement.className = 'hc-canvas'; document.body.prepend(renderer.domElement);
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 4000); scene.add(camera);
scene.environment = new THREE.Texture();   // replaced per track (keeps cine from adding its studio env)
const C = cine(renderer, scene, camera, { bloom: 0.3, bloomThreshold: 0.92, bloomRadius: 0.4, exposure: 1.1, lite, grade: { sat: 1.16, contrast: 1.05, vignette: 0.12, grain: 0 } });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const blur = radialBlur(); C.composer.insertPass(blur, 1);
const hemi = new THREE.HemisphereLight('#cfe6ff', '#f2c79a', 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d0', 2.7); sun.castShadow = true; sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 260 }); scene.add(sun, sun.target);
const pool = new WheelPool(scene, 64);
const puffs = new Puffs(scene, lite ? 400 : 800), sparks = new Sparks(scene, 320), skids = new Skids(scene), lines = new SpeedLines(camera);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); C.resize(innerWidth, innerHeight);
  puffs.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
}
addEventListener('resize', resize);

// cones (dynamic, instanced)
const coneGeo = (() => { const g = new THREE.ConeGeometry(0.32, 0.8, 12); g.translate(0, 0.4, 0); fin(g, '#ff7a1a'); const c = g.attributes.color, p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.35 && y < 0.55) c.setXYZ(i, 1, 1, 1); } return g; })();
const coneMesh = new THREE.InstancedMesh(coneGeo, toon('#ffffff', { vertexColors: true }), 80), coneOl = new THREE.InstancedMesh(coneGeo, outlineMat(0.03), 80);
coneMesh.castShadow = true; for (const m of [coneMesh, coneOl]) { m.count = 0; m.frustumCulled = false; scene.add(m); }

// ---------------------------------------------------------------- track + world
let T = null, world = null, trackKey = '', theme = THEMES[0], envTex = null, rampsList = [], cones = [];
function loadTrack(ti, rev, seed = 1) {
  const key = ti + ':' + rev + ':' + seed; if (key === trackKey) return;
  trackKey = key;
  if (world) { scene.remove(world.group); world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); for (const m of [].concat(o.material || [])) { if (!m) continue; for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); } }); }
  T = new Track(TRACKS[ti], rev); theme = THEMES[TRACKS[ti].theme];
  world = buildWorld(scene, T, theme, { lite, seed: ti * 31 + (rev ? 7 : 0) + seed });
  if (envTex) envTex.dispose(); envTex = skyEnv(renderer, theme); scene.environment = envTex; scene.environmentIntensity = 0.75;
  scene.fog = new THREE.Fog(theme.fog, 160, 1300); scene.background = new THREE.Color(theme.sky[2]);
  hemi.color.set(theme.hemi[0]); hemi.groundColor.set(theme.hemi[1]); sun.color.set(theme.sun);
  rampsList = world.ramps.slice().sort((a, b) => a.s - b.s);
  cones = world.cones.map(c => { const p = T.at(c.s, {}); return { x: p.x + p.rx * c.d, y: p.y + 0.02, z: p.z + p.rz * c.d, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, hit: false, home: [p.x + p.rx * c.d, p.y + 0.02, p.z + p.rz * c.d] }; }).slice(0, 80);
  drawMapBase(); skids.clear();
}
function resetCones() { for (const c of cones) { [c.x, c.y, c.z] = c.home; c.vx = c.vy = c.vz = c.rx = c.rz = 0; c.hit = false; } }

// ---------------------------------------------------------------- events
const EVENTS = [[0, false, 1], [1, false, 1], [4, false, 2], [3, false, 2], [2, false, 3], [0, true, 3], [1, true, 4], [4, true, 4], [3, true, 5], [2, true, 5]];
function eventSpec(n) { const e = EVENTS[n % EVENTS.length], lap = Math.floor(n / EVENTS.length); return { mode: 'career', n, t: e[0], rev: e[1], tier: Math.min(6, e[2] + lap) }; }
function dayNum() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function dailySpec() { const r = rng(D.seed || dayNum()); r(); return { mode: 'ta', t: Math.floor(r() * TRACKS.length), rev: r() < 0.5, tier: 3, seed: Math.floor(r() * 1000) + 1 }; }
const specName = sp => `${TRACKS[sp.t].name}${sp.rev ? ' (Reverse)' : ''}`;
const specKind = sp => sp.mode === 'ta' ? 'Time attack' : TRACKS[sp.t].kind === 'sprint' ? 'Sprint' : `Circuit · ${TRACKS[sp.t].laps} laps`;
const NAMES = ['VEX', 'KAITO', 'RUBY', 'MAKO', 'JINX', 'NOVA', 'SABLE', 'ROOK', 'ECHO', 'BLAZE', 'PIXIE', 'DASH'];

// ---------------------------------------------------------------- racers
let racers = [], traffic = [], player = null, spec = null, raceLen = 0, raceT = 0, state = 'ready', phase = 'menu', cdT = 0, endT = 0, botUntil = 0;
const tmp = { i: 0, s: 0, d: 0 }, P0 = {};
function newBody(o) {
  return Object.assign({ x: 0, z: 0, y: 0, yaw: 0, va: 0, speed: 0, slip: 0, drift: 0, yawRate: 0, nitro: 0.4, nitroOn: false, h: 0, vy: 0, air: false, airT: 0, rampH: 0,
    idx: -1, s: 0, d: 0, prog: 0, lap: 1, finished: false, finishT: 0, in: { steer: 0, thr: 0, brk: 0, drift: false, nitro: false }, score: 0, chain: 0, wall: 0, spin: 0, near: new Set(), back: 0, wrong: 0 }, o);
}
function placeAt(c, s, d) {
  const p = T.at(s, P0); c.x = p.x + p.rx * d; c.z = p.z + p.rz * d; c.yaw = c.va = Math.atan2(p.tx, p.tz); c.idx = -1; T.locate(c.x, c.z, -1, tmp); c.idx = tmp.i; c.s = tmp.s; c.d = tmp.d; c.y = p.y;
}
function disposeCar(car) { car.root.parent && car.root.parent.remove(car.root); }
function clearRace() { for (const r of racers) disposeCar(r.car); for (const t of traffic) disposeCar(t.car); racers = []; traffic = []; pool.clear(); }

function setupRace(sp) {
  spec = sp; clearRace(); loadTrack(sp.t, sp.rev, sp.seed || 1); resetCones(); skids.clear();
  const closed = T.closed, laps = TRACKS[sp.t].laps || 1; raceLen = closed ? laps * T.L : T.finishS - T.startS; spec.laps = closed ? laps : 1;
  const R = rng((sp.n || 0) * 97 + sp.t * 13 + (sp.seed || 1));
  // player at the back of the grid; rivals ahead in a staggered 2-wide grid
  const n = sp.mode === 'ta' ? 1 : 6;
  const k = clamp(F.k(), 0.9, 1.12), skill = clamp((0.8 + 0.04 * sp.tier) * k, 0.78, 1.02);
  for (let g = 0; g < n; g++) {
    const isP = g === n - 1, mid = isP ? save.car : MODELS[Math.min(MODELS.length - 1, Math.floor(R() * Math.min(MODELS.length, 1 + sp.tier)))].id;
    const lvl = Math.min(5, Math.max(0, sp.tier - 1 + Math.floor(R() * 2) - 1)), st = isP ? statsFor(save.car) : statsFor(mid, { e: lvl, n: lvl, h: lvl });
    if (!isP) st.top *= 0.88 + 0.03 * sp.tier;
    const look = isP ? lookOf(save.car) : { paint: PAINTS[(g * 5 + sp.t * 3 + (sp.n || 0)) % PAINTS.length][1], finish: g % 3, rim: RIMS[(g + 1) % RIMS.length][1], livery: 1 + g % 3, num: 10 + g * 7, accent: ['#ffffff', '#1b1530', '#ffd23f'][g % 3] };
    const car = makeCar(MODEL[mid], look, pool, { shadow: true }); scene.add(car.root);
    const c = newBody({ car, isP, st, name: isP ? 'YOU' : NAMES[(g + (sp.n || 0) * 5 + sp.t) % NAMES.length], color: look.paint, ai: { lane: (R() - 0.5) * 10, skill: isP ? 1.04 : skill * (0.97 + R() * 0.06), dr: 0 } });
    const row = Math.floor(g / 2), col = g % 2 ? 1 : -1, s0 = (closed ? T.L : T.startS) - 9 - row * 10 - (g % 2) * 4.5;
    placeAt(c, s0, col * 4.4); c.prog = closed ? c.s - T.L : c.s - T.startS; c.nitro = 0.35;
    racers.push(c); if (isP) player = c;
  }
  const NT = lite ? 6 : 9;
  for (let i = 0; i < NT; i++) {
    const m = TRAFFIC[i % TRAFFIC.length], col = m.taxi ? '#ffc400' : ['#f2f4f8', '#ff6b5a', '#5ab0ff', '#7bd651', '#c9a7ff', '#ffd36e', '#ff9de0'][i % 7];
    const car = makeCar(m, { paint: col }, pool, { traffic: true, shadow: !lite }); scene.add(car.root);
    const t = newBody({ car, traffic: true, st: { top: 26, acc: 6, hand: 0.9, nos: 1 }, ai: { lane: [-6.75, -2.25, 2.25, 6.75][i % 4], tv: 15 + (i * 7) % 9 } });
    t.active = false; traffic.push(t);
  }
  placeTraffic(true);
  raceT = 0; phase = 'grid'; for (const c of racers) { c.score = 0; c.chain = 0; }
  updateCars(0); hudCars();
}
function placeTraffic(all) {
  if (!player) return;
  traffic.forEach((t, i) => {
    const rel = t.active ? relS(t.s, player.s) : -999;
    if (!all && t.active && rel > -45 && rel < 650) return;
    let s = player.s + (all ? 120 + i * 85 : 330 + Math.random() * 260);
    if (!T.closed && (s > T.finishS - 30 || s < 40)) { t.active = false; t.car.root.visible = false; return; }
    if (all && !T.closed && s > T.finishS - 30) { t.active = false; t.car.root.visible = false; return; }
    const lane = [-6.75, -2.25, 2.25, 6.75][Math.floor(Math.random() * 4)];
    for (const o of traffic) if (o !== t && o.active && Math.abs(relS(o.s, s)) < 14 && Math.abs(o.d - lane) < 3) s += 22;
    t.ai.lane = lane; placeAt(t, s, lane); t.speed = t.ai.tv; t.active = true; t.car.root.visible = true; t.spin = 0; t.near.clear();
  });
}
const relS = (a, b) => { let d = a - b; if (T.closed) { d = ((d % T.L) + T.L) % T.L; if (d > T.L / 2) d -= T.L; } return d; };

// ---------------------------------------------------------------- driving AI (CPU, traffic and the test bot all use it)
const cornerV = (k, st, drift) => { if (k < 1e-4) return 999; const R = 1 / k, Y = 1.65 * st.hand * (drift ? 1.3 : 1); return R * Y / (1 + 0.38 * R * Y / st.top); };
function ai(c, out) {
  const v = c.speed, st = c.st, sk = c.ai.skill;
  if (c.traffic) {
    const p = T.at(c.s + 9 + v * 0.3, P0), tx = p.x + p.rx * c.ai.lane, tz = p.z + p.rz * c.ai.lane, e = wrapA(Math.atan2(tx - c.x, tz - c.z) - c.va);
    out.steer = clamp(-e * 2.2, -1, 1); out.thr = c.spin > 0 ? 0 : v < c.ai.tv ? 0.8 : 0; out.brk = 0; out.drift = false; out.nitro = false;
    for (const o of racers) { const r = relS(o.s, c.s); if (r > 0 && r < 12 && Math.abs(o.d - c.d) < 2.4 && o.speed < v) out.thr = 0; }
    return;
  }
  // racing line: lean to the inside of the corner ahead, dodge what's in front
  const a40 = T.at(c.s + 30 + v * 0.4, P0), ri = c.idx < 0 ? 0 : c.idx, inside = clamp((a40.tx * T.RX[ri] + a40.tz * T.RZ[ri]) * 3, -1, 1);
  let line = clamp(c.ai.lane * 0.45 + inside * (W - 3), -W + 2, W - 2);
  let block = null, bestD = 1e9;
  for (const o of racers.concat(traffic)) { if (o === c || (o.traffic && !o.active)) continue; const r = relS(o.s, c.s); if (r > 1 && r < 18 + v * 0.55 && Math.abs(o.d - line) < 2.7 && r < bestD) { bestD = r; block = o; } }
  c.ai.bl = block ? 1 : 0;
  if (block) {
    const l1 = block.d - 3.3, l2 = block.d + 3.3, ok1 = l1 > -W + 1.6, ok2 = l2 < W - 1.6;
    if (!c.ai.side || c.ai.sideT <= 0) { c.ai.side = ok1 && (!ok2 || Math.abs(l1 - c.d) < Math.abs(l2 - c.d)) ? -1 : 1; c.ai.sideT = 0.8; }
    line = c.ai.side < 0 ? (ok1 ? l1 : l2) : (ok2 ? l2 : l1);
  }
  c.ai.sideT = (c.ai.sideT || 0) - 1 / 60;
  const la = 7 + v * 0.42, p = T.at(c.s + la, P0), tx = p.x + p.rx * line, tz = p.z + p.rz * line;
  const e = wrapA(Math.atan2(tx - c.x, tz - c.z) - c.va);
  out.steer = clamp(-e * (2.0 + sk), -1, 1);
  // speed: slowest allowed corner speed in the braking window
  let allow = 999, kHere = Math.abs(T.K[ri]);
  const drifty = sk > 0.86;
  for (let s = 0; s < v * 1.7 + 30; s += 4) { const i = T.wrapI(Math.round((c.s + s) / T.ds)), vc = cornerV(Math.abs(T.K[i]), st, drifty) * sk; allow = Math.min(allow, Math.sqrt(vc * vc + 2 * 22 * Math.max(0, s - 6))); }
  out.thr = v < allow ? 1 : 0; out.brk = v > allow + 4 ? 1 : 0;
  // drift through tight corners, nitro on clear straights
  if (c.drift) c.ai.dr = kHere > 1 / 120 ? 0.3 : c.ai.dr - 1 / 60; else c.ai.dr = drifty && kHere > 1 / 75 && v > cornerV(kHere, st, false) * sk - 2 && Math.abs(out.steer) > 0.3 ? 0.3 : 0;
  out.drift = c.ai.dr > 0; if (out.drift) out.brk = 0;
  out.nitro = c.nitro > 0.05 && allow > st.top * 1.15 && (!block || c.isP) && (c.nitroOn || c.nitro > 0.3) && sk > 0.82;
}

// ---------------------------------------------------------------- physics (same for everyone)
function rampAt(s, d) {
  for (const r of rampsList) { const u = relS(s, r.s); if (u >= 0 && u <= r.len && Math.abs(d - r.d) < r.w / 2 + 0.4) return r.h * u / r.len; if (r.s > s + 20 && !T.closed) break; }
  return 0;
}
function physics(c, dt) {
  const inp = c.in, st = c.st;
  // nitro
  const nos = inp.nitro && c.nitro > 0.01;
  if (nos && !c.nitroOn && c.isP) { A.nitro(); flash(0.6); buzz(20); }
  c.nitroOn = nos; if (nos) c.nitro = Math.max(0, c.nitro - dt * 0.26 / st.nos); else if (!c.traffic) c.nitro = Math.min(1, c.nitro + dt * 0.025);
  const top = st.top * (nos ? 1.3 : 1), acc = st.acc * (nos ? 2.0 : 1);
  if (!c.air) {
    if (inp.brk) c.speed = Math.max(0, c.speed - 28 * dt);
    else if (inp.thr > 0 && c.speed < top) c.speed += acc * inp.thr * Math.max(0.1, 1 - (c.speed / top) ** 3) * dt;
    if (c.speed > top) c.speed -= (c.speed - top) * 0.9 * dt;
    if (!inp.thr && !inp.brk) c.speed -= c.speed * 0.25 * dt;
    if (inp.drift && Math.abs(inp.steer) < 0.15 && !c.drift) c.speed = Math.max(0, c.speed - 14 * dt);
  }
  const v = c.speed, sf = Math.min(1, v / 9) * (1 - 0.38 * Math.min(1, v / st.top)), Y = 1.65 * st.hand;
  // drift state
  if (!c.drift && inp.drift && Math.abs(inp.steer) > 0.2 && v > 16 && !c.air) { c.drift = Math.sign(inp.steer); c.chain = 0; c.wall = 0; }
  if (c.drift && (!inp.drift || v < 11)) endDrift(c);
  if (c.air) {
    c.yaw += -inp.steer * 0.6 * dt; c.va += wrapA(c.yaw - c.va) * Math.min(1, 1.5 * dt);
  } else if (c.drift) {
    const dir = c.drift, sd = inp.steer * dir, w = -dir * Y * 1.3 * Math.max(0.3, 0.62 + 0.45 * sd) * Math.min(1, v / 18);
    c.va += w * dt; const target = -dir * (0.36 + 0.22 * Math.max(0, sd)); c.slip += (target - c.slip) * Math.min(1, 5 * dt);
    c.yaw = c.va + c.slip; c.yawRate = w; c.speed *= 1 - 0.055 * dt;
    c.nitro = Math.min(1, c.nitro + dt * 0.2); c.chain += v * Math.abs(c.slip) * 9 * dt;
  } else {
    const target = -inp.steer * Y * sf; c.yawRate += (target - c.yawRate) * Math.min(1, 10 * dt); c.yaw += c.yawRate * dt;
    const diff = wrapA(c.yaw - c.va); c.va += diff * Math.min(1, 8 * dt); c.slip = wrapA(c.yaw - c.va); c.speed *= 1 - Math.abs(diff) * 0.6 * dt;
  }
  if (c.spin > 0) { c.spin -= dt; c.yaw += c.spinR * dt; }
  c.x += Math.sin(c.va) * c.speed * dt; c.z += Math.cos(c.va) * c.speed * dt;
  const ps = c.s; T.locate(c.x, c.z, c.idx, tmp); c.idx = tmp.i; c.s = tmp.s; c.d = tmp.d;
  let dsd = c.s - ps; if (T.closed) { if (dsd > T.L / 2) dsd -= T.L; if (dsd < -T.L / 2) dsd += T.L; } c.prog += dsd;
  // ground: road height + ramps + flight
  const along = (c.x - T.X[c.idx]) * T.TX[c.idx] + (c.z - T.Z[c.idx]) * T.TZ[c.idx];
  c.y = T.yAt(c.idx, along);
  const rh = c.traffic ? 0 : rampAt(c.s, c.d);
  if (c.air) {
    c.vy -= 24 * dt; c.h += c.vy * dt; c.airT += dt;
    if (c.h <= rh) { c.h = rh; c.air = false; land(c); }
  } else {
    if (c.rampH > 0.4 && rh === 0 && v > 12) { c.air = true; c.vy = v * 0.17; c.h = c.rampH; c.airT = 0; if (c.isP) A.whoosh(); }
    else c.h = rh;
  }
  c.rampH = rh;
  // walls
  const lim = W - 1.05;
  if (Math.abs(c.d) > lim) {
    const sg = Math.sign(c.d), push = Math.abs(c.d) - lim, nx = T.RX[c.idx] * sg, nz = T.RZ[c.idx] * sg;
    c.x -= nx * push; c.z -= nz * push; c.d = sg * lim;
    let vx = Math.sin(c.va) * c.speed, vz = Math.cos(c.va) * c.speed; const vn = vx * nx + vz * nz;
    if (vn > 0) { vx -= nx * vn * 1.25; vz -= nz * vn * 1.25; const f = 1 - Math.min(0.3, vn * 0.025); vx *= f; vz *= f; c.va = Math.atan2(vx, vz); c.speed = Math.hypot(vx, vz); c.yaw += wrapA(c.va - c.yaw) * 0.35; }
    c.wall = 0.15;
    if (c.drift) { c.chainLost = true; endDrift(c); }
    if (!c.traffic && c.speed > 8) for (let k = 0; k < 2; k++) sparks.emit(c.x + nx * 1.0 + (Math.random() - 0.5), c.y + c.h + 0.35, c.z + nz * 1.0 + (Math.random() - 0.5), Math.sin(c.va) * c.speed * 0.6 - nx * 5 + (Math.random() - 0.5) * 6, 2 + Math.random() * 5, Math.cos(c.va) * c.speed * 0.6 - nz * 5 + (Math.random() - 0.5) * 6, 0.4 + Math.random() * 0.3);
    if (c.isP && vn > 7) { A.hit(Math.min(1, vn / 20)); shake = Math.min(1, vn / 14); buzz(30); }
  }
  if (c.wall > 0) c.wall -= dt;
}
function endDrift(c) {
  c.drift = 0;
  if (!c.isP || c.chain < 30) return;
  if (c.chainLost) { pop('DRIFT LOST', '#ff4a6e', 28); c.chainLost = false; return; }
  const pts = Math.round(c.chain / 10) * 10; c.score += pts; pop(`DRIFT +${pts}`, '#ffd23f', pts > 600 ? 40 : 32); A.pop(Math.min(4, pts / 300)); c.chain = 0;
}
function land(c) {
  if (c.airT > 0.25) {
    for (let k = 0; k < 10; k++) puffs.emit(c.x + (Math.random() - 0.5) * 2.5, c.y + 0.3, c.z + (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 6, 1 + Math.random() * 2, (Math.random() - 0.5) * 6, 1.4, 0.8, DUST, 0.7, 3);
    if (c.isP) { const pts = Math.round(c.airT * 500 / 10) * 10; c.score += pts; pop(`BIG AIR +${pts}`, '#2ec4ff', 36); A.land(); shake = 0.5; buzz(25); }
  }
  c.airT = 0;
}
// car-vs-car: two circles per car, equal-ish masses, elastic-ish impulse
const circ = (c, k) => [c.x + Math.sin(c.yaw) * k * 1.15, c.z + Math.cos(c.yaw) * k * 1.15];
function collide(a, b) {
  const dx0 = a.x - b.x, dz0 = a.z - b.z; if (dx0 * dx0 + dz0 * dz0 > 36 || Math.abs(a.h - b.h) > 1.5) return;
  for (const ka of [-1, 1]) for (const kb of [-1, 1]) {
    const [ax, az] = circ(a, ka), [bx, bz] = circ(b, kb), dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), R = 2.05;
    if (d >= R || d < 1e-4) continue;
    const nx = dx / d, nz = dz / d, ma = a.traffic ? 1.6 : 1, mb = b.traffic ? 1.6 : 1, pen = R - d, wa = mb / (ma + mb), wb = ma / (ma + mb);
    a.x += nx * pen * wa; a.z += nz * pen * wa; b.x -= nx * pen * wb; b.z -= nz * pen * wb;
    let avx = Math.sin(a.va) * a.speed, avz = Math.cos(a.va) * a.speed, bvx = Math.sin(b.va) * b.speed, bvz = Math.cos(b.va) * b.speed;
    const rel = (avx - bvx) * nx + (avz - bvz) * nz;
    if (rel < 0) {
      const j = -(1.3) * rel / (1 / ma + 1 / mb); avx += j * nx / ma; avz += j * nz / ma; bvx -= j * nx / mb; bvz -= j * nz / mb;
      a.va = Math.atan2(avx, avz); a.speed = Math.max(0, Math.hypot(avx, avz) * (Math.cos(wrapA(a.va - a.yaw)) > 0 ? 1 : 0.2)); b.va = Math.atan2(bvx, bvz); b.speed = Math.max(0, Math.hypot(bvx, bvz));
      a.va = a.yaw + clamp(wrapA(a.va - a.yaw), -0.5, 0.5); b.va = b.yaw + clamp(wrapA(b.va - b.yaw), -0.5, 0.5);
      const hit = -rel;
      for (const [c, o] of [[a, b], [b, a]]) {
        if (c.traffic && hit > 4) { c.spin = 1.0; c.spinR = (Math.random() < 0.5 ? -1 : 1) * Math.min(3, hit * 0.15); }
        if (c.isP && hit > 3) { A.hit(Math.min(1, hit / 18)); shake = Math.min(1, hit / 12); buzz(40); if (c.drift) { c.chainLost = true; endDrift(c); } if (o.traffic) pop('CRASH!', '#ff4a6e', 30); }
      }
      if (hit > 5) for (let k = 0; k < 8; k++) sparks.emit((ax + bx) / 2, Math.max(a.y, b.y) + 0.6, (az + bz) / 2, (Math.random() - 0.5) * 12, 2 + Math.random() * 5, (Math.random() - 0.5) * 12, 0.5);
    }
  }
}

// ---------------------------------------------------------------- input
const keys = new Set(), touch = { l: false, r: false, d: false, n: false };
let tiltSteer = 0, tilt0 = null;
addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'KeyR' && phase === 'race' && player) respawn(player); if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); A.init(); });
addEventListener('keyup', e => keys.delete(e.code));
for (const [id, k] of [['bl', 'l'], ['br', 'r'], ['bd', 'd'], ['bn', 'n']]) {
  const el = $(id); const on = v => e => { e.preventDefault(); e.stopPropagation(); touch[k] = v; el.classList.toggle('on', v); A.init(); };
  el.addEventListener('pointerdown', on(true)); el.addEventListener('pointerup', on(false)); el.addEventListener('pointercancel', on(false)); el.addEventListener('pointerleave', on(false));
}
addEventListener('deviceorientation', e => { if (save.steer !== 'tilt' || e.gamma == null) return; const g = (screen.orientation && Math.abs(screen.orientation.angle) === 90) ? e.beta * Math.sign(screen.orientation.angle) : e.gamma; if (tilt0 === null) tilt0 = g; tiltSteer = clamp((g - tilt0) / 20, -1, 1); });
function playerInput(c) {
  if (performance.now() < botUntil) { ai(c, c.in); return; }
  const kl = keys.has('ArrowLeft') || keys.has('KeyA') || touch.l, kr = keys.has('ArrowRight') || keys.has('KeyD') || touch.r;
  let steer = (kr ? 1 : 0) - (kl ? 1 : 0); if (save.steer === 'tilt' && isTouch) steer = Math.abs(tiltSteer) > 0.06 ? tiltSteer : 0;
  c.in.steer += (steer - c.in.steer) * 0.35;
  c.in.brk = keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0; c.in.thr = c.in.brk ? 0 : 1;
  c.in.drift = keys.has('Space') || touch.d; c.in.nitro = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyN') || touch.n;
}
function respawn(c) { placeAt(c, c.s, clamp(c.d, -W + 3, W - 3)); c.speed = 15; c.drift = 0; c.air = false; c.h = 0; c.wrong = 0; c.back = 0; }

// ---------------------------------------------------------------- juice
let shake = 0, fovKick = 0, lastPos = 6;
const DUST = new THREE.Color('#d8cfc0'), SMOKE = new THREE.Color('#ffffff'), BLUE = new THREE.Color('#8fe0ff');
function pop(t, col = '#fff', size = 32) { if (phase === 'race') ui.pop(t, col, size, 27); }
function flash(a) { const f = $('flash'); f.style.opacity = a; setTimeout(() => f.style.opacity = 0, 160); }

// ---------------------------------------------------------------- race flow
function startCountdown() {
  A.init(); A.music(true); A.intensity(0.35);
  ui.hideStart(); closeSheets(); $('hud').classList.remove('off'); B.start(); cashPill.style.display = 'none';
  phase = 'count'; state = 'play'; cdT = 3.2; raceT = 0; tilt0 = null; beatenShown = false;
  $('cd').textContent = ''; lastPos = 6;
}
let beatenShown = false;
function finishPlayer() {
  endT = 1.6; phase = 'end'; if (player.drift) endDrift(player);
  const order = standings(), place = order.indexOf(player) + 1;
  for (const c of racers) if (!c.finished) { c.finishT = raceT + (raceLen - c.prog) / Math.max(18, c.speed * 0.9); }
  let score = player.score, bonus = 0, cash = 0;
  if (spec.mode === 'ta') { const par = raceLen / 44; bonus = Math.max(0, Math.round((par * 1.7 - player.finishT) * 140)); cash = 600; }
  else { bonus = [6000, 4200, 3000, 2000, 1200, 800][place - 1]; cash = [2000, 1400, 1000, 700, 500, 300][place - 1]; }
  score += bonus; cash += Math.floor(player.score / 5);
  const won = spec.mode === 'ta' || place <= 3;
  const bk = trackKey; const prevBest = save.best[bk] || 0; if (!prevBest || player.finishT < prevBest) save.best[bk] = player.finishT;
  save.cash += cash; if (won && spec.mode === 'career' && spec.n === save.event) save.event++;
  persist();
  if (spec.mode === 'career') F.level(won, clamp(player.prog / raceLen, 0, 1));
  B.submit(score, { ms: raceT * 1000 + 3200 });
  result = { place, score, bonus, cash, won, order, time: player.finishT, newBest: !prevBest || player.finishT < prevBest };
  A.music(false); won ? A.win() : A.lose(); if (won) setTimeout(() => confetti(scene, new THREE.Vector3(player.x, player.y + 3, player.z), 90), 300);
}
let result = null;
function showResults() {
  const r = result; phase = 'results'; state = r.won ? 'won' : 'lost'; $('hud').classList.add('off');
  const ord = r.order.map(c => c).sort((a, b) => a.finishT - b.finishT);
  const tbl = spec.mode === 'ta' ? '' : `<div class="tbl">${ord.map((c, i) => `<div class="r ${c.isP ? 'me' : ''}"><span>${i + 1}</span><span class="dot" style="background:${c.color}"></span><span>${c.name}</span><span>${fmt(c.finishT)}</span></div>`).join('')}</div>`;
  const ord1 = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'][r.place - 1];
  const html = `<div class="res zb"><div class="place">${spec.mode === 'ta' ? fmt(r.time) : ord1}</div>
    <div class="sub zb-o">${specName(spec)} · ${spec.mode === 'ta' ? 'Daily time attack' : fmt(r.time)}${r.newBest ? ' · NEW BEST' : ''}</div>${tbl}
    <div class="rew"><span>Score <b>${r.score.toLocaleString()}</b></span><span>Style <b>${Math.round(player.score)}</b></span><span>Cash <b>+${r.cash.toLocaleString()}</b></span></div>
    <div class="row"><button class="btn blue" data-g>Garage</button><button class="btn" data-m>Menu</button></div></div>`;
  const card = r.won ? ui.els.win : ui.els.lose;
  let box = card.querySelector('.resbox'); if (!box) { box = document.createElement('div'); box.className = 'resbox'; card.querySelector('h1').after(box); }
  box.innerHTML = html; card.dataset.r = 1;
  card.querySelector('h1').textContent = r.won ? (spec.mode === 'ta' ? 'FINISHED!' : r.place === 1 ? 'YOU WIN!' : 'PODIUM!') : 'SO CLOSE!';
  for (const b of box.querySelectorAll('button')) b.addEventListener('pointerdown', e => e.stopPropagation());
  box.querySelector('[data-g]').onpointerdown = e => { e.stopPropagation(); card.classList.add('hc-hidden'); showMenu(); openGarage(); };
  box.querySelector('[data-m]').onpointerdown = e => { e.stopPropagation(); card.classList.add('hc-hidden'); showMenu(); };
  card.querySelector('.hint').textContent = r.won ? (spec.mode === 'career' ? 'Tap for the next race' : 'Tap to race again') : 'Tap to retry';
  if (r.won) { D.won(r.score, 'scored'); ui.win(1, ''); } else ui.lose('SO CLOSE!', '');
  A.cash();
}
const fmt = t => { if (!isFinite(t)) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
function standings() { return racers.slice().sort((a, b) => (a.finished && b.finished) ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog); }
ui.onTap(which => {
  A.init();
  if (which === 'start') { const sp = D.isDaily ? dailySpec() : eventSpec(save.event); if (!spec || spec.mode !== sp.mode || spec.n !== sp.n || spec.t !== sp.t) setupRace(sp); startCountdown(); return; }
  if (which === 'win') { setupRace(spec.mode === 'career' ? eventSpec(save.event) : spec.mode === 'ta' ? dailySpec() : { ...spec }); startCountdown(); return; }
  if (which === 'lose') { setupRace({ ...spec }); startCountdown(); }
});
$('pause').addEventListener('pointerdown', e => { e.stopPropagation(); if (phase === 'race' || phase === 'count') { A.music(false); $('hud').classList.add('off'); showMenu(); } });

// ---------------------------------------------------------------- main loop
let last = performance.now(), acc = 0, camYaw = 0, menuA = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), V = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dtR = Math.min(0.1, (now - last) / 1000); last = now;
  if (phase === 'count') {
    const prev = Math.ceil(cdT); cdT -= dtR; const cur = Math.ceil(cdT);
    if (cur !== prev && cur > 0 && cur <= 3) { $('cd').textContent = cur; $('cd').className = 'zb-o'; void $('cd').offsetWidth; $('cd').className = 'zb-o go'; A.beep(false); }
    if (cdT <= 0) { phase = 'race'; $('cd').textContent = 'GO!'; $('cd').className = 'zb-o go'; A.beep(true); setTimeout(() => { if ($('cd').textContent === 'GO!') $('cd').textContent = ''; }, 700); A.intensity(0.7); }
    for (const c of racers) { c.in.thr = 0; }
  }
  if (phase === 'race' || phase === 'end') {
    acc += dtR; let n = 0;
    while (acc >= 1 / 60 && n < 4) { step(1 / 60); acc -= 1 / 60; n++; }
    if (n === 4) acc = 0;
  }
  if (phase === 'end') { endT -= dtR; if (endT <= 0) showResults(); }
  updateCars(dtR); updateCones(dtR); updateCamera(dtR);
  puffs.update(dtR); sparks.update(dtR); skids.update(); updateParticles(dtR * 60);
  pool.update();
  if (phase === 'race' || phase === 'count' || phase === 'end') hud(dtR);
  C.render(dtR);
}
function step(dt) {
  raceT += phase === 'race' || phase === 'end' ? dt : 0;
  for (const c of racers) { if (c.isP && phase === 'race' && !c.finished) playerInput(c); else ai(c, c.in); if (c.finished && !c.isP) c.in.thr = c.speed > 20 ? 0 : 0.3; physics(c, dt); }
  for (const t of traffic) if (t.active) { ai(t, t.in); physics(t, dt); }
  const all = racers.concat(traffic.filter(t => t.active));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) collide(all[i], all[j]);
  for (const c of racers) {
    if (!c.finished && c.prog >= raceLen) { c.finished = true; c.finishT = raceT; if (c.isP) finishPlayer(); }
    if (T.closed) c.lap = clamp(Math.floor(c.prog / T.L) + 1, 1, spec.laps);
    // stuck / wrong way recovery
    const fwd = Math.sin(c.yaw) * T.TX[c.idx] + Math.cos(c.yaw) * T.TZ[c.idx];
    c.wrong = fwd < -0.2 && c.speed > 3 ? c.wrong + dt : 0; c.back = c.speed < 3 && phase === 'race' ? c.back + dt : 0;
    if (c.wrong > 2.5 || c.back > 2.5) respawn(c);
  }
  // near misses, cones
  if (player && phase === 'race') {
    for (const t of traffic) { if (!t.active) continue; const r = relS(t.s, player.s), dd = Math.abs(t.d - player.d);
      if (Math.abs(r) < 3 && dd > 2.1 && dd < 3.6 && player.speed - t.speed > 10 && !t.near.has('p')) { t.near.add('p'); player.score += 200; player.nitro = Math.min(1, player.nitro + 0.08); pop('NEAR MISS +200', '#7bd651', 30); A.pop(2); }
      if (r < -8) t.near.delete('p'); }
    placeTraffic(false);
  }
  for (const c of racers) for (const k of cones) if (!k.hit) { const dx = k.x - c.x, dz = k.z - c.z; if (dx * dx + dz * dz < 2.2 && c.h < 1) {
    k.hit = true; const v = Math.max(8, c.speed); k.vx = Math.sin(c.va) * v * 0.8 + (dx) * 3; k.vz = Math.cos(c.va) * v * 0.8 + dz * 3; k.vy = 5 + Math.random() * 4; k.sr = (Math.random() - 0.5) * 14;
    if (c.isP) { c.score += 50; A.cone(); pop('CONE +50', '#ff9a1a', 26); c.speed *= 0.985; } } }
  if (player && D.beaten(player.score) && !beatenShown) { beatenShown = true; pop('BEATEN!', '#ffd23f', 44); confetti(scene, new THREE.Vector3(player.x, player.y + 3, player.z), 40); }
}
function updateCones(dt) {
  let n = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
  for (const k of cones) {
    if (k.hit && k.y > -6) { k.vy -= 20 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt; k.rx += k.sr * dt; k.rz += k.sr * 0.7 * dt; if (k.y < k.home[1] && k.vy < 0) { k.y = k.home[1]; k.vy *= -0.3; k.vx *= 0.7; k.vz *= 0.7; k.sr *= 0.6; k.rx = Math.PI / 2; } }
    m.compose(V.set(k.x, k.y, k.z), q.setFromEuler(e.set(k.rx, 0, k.rz)), s); coneMesh.setMatrixAt(n, m); coneOl.setMatrixAt(n, m); n++;
  }
  coneMesh.count = coneOl.count = n; coneMesh.instanceMatrix.needsUpdate = coneOl.instanceMatrix.needsUpdate = true;
}
function updateCars(dt) {
  for (const c of racers.concat(traffic)) {
    const car = c.car; if (c.traffic && !c.active) continue;
    car.root.position.set(c.x, c.y + c.h, c.z); car.root.rotation.y = c.yaw;
    const lean = clamp(c.yawRate * c.speed * 0.0035, -0.08, 0.08) * (c.air ? 0 : 1);
    car.body.rotation.z += (lean - car.body.rotation.z) * Math.min(1, 8 * dt);
    const pitch = c.air ? clamp(-c.vy * 0.02, -0.25, 0.25) : (c.in.brk ? 0.03 : c.in.thr && c.speed < c.st.top * 0.5 ? -0.025 : 0) + (c.h > 0 ? -0.14 : 0);
    car.body.rotation.x += (pitch - car.body.rotation.x) * Math.min(1, 8 * dt);
    car.body.position.y = Math.sin(performance.now() * 0.02 + c.x) * 0.006 * Math.min(1, c.speed / 30);
    for (const w of car.wheels) { w.spin.rotation.x += c.speed * dt / car.model.R; if (w.front) w.steer.rotation.y = c.drift ? clamp(-c.slip * 0.9, -0.5, 0.5) : -c.in.steer * 0.42; }
    if (car.tailMat) car.tailMat.emissiveIntensity = c.in.brk || (c.speed < 1 && phase !== 'menu') ? 3.2 : 0.8;
    if (car.flames) { car.flames.visible = c.nitroOn; if (c.nitroOn) car.flames.children.forEach((f, i) => f.scale.set(1, 1, 0.7 + Math.random() * 0.8)); }
    // smoke + skid marks for drifting / hard braking racers
    if (!c.traffic && phase !== 'menu' && !c.air && (c.drift || (c.in.brk && c.speed > 15))) {
      const sx = Math.sin(c.yaw), cz = Math.cos(c.yaw), rx = -cz, rz = sx, back = car.model.L * 0.3;
      for (const sd of [-1, 1]) {
        const wx = c.x - sx * back + rx * sd * 0.85, wz = c.z - cz * back + rz * sd * 0.85;
        if (c.lastSk && c.lastSk[sd]) skids.seg(c.lastSk[sd][0], c.y + 0.045, c.lastSk[sd][1], wx, c.y + 0.045, wz);
        (c.lastSk || (c.lastSk = {}))[sd] = [wx, wz];
        if (Math.random() < (lite ? 0.35 : 0.7)) puffs.emit(wx, c.y + 0.35, wz, -sx * c.speed * 0.15 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), -cz * c.speed * 0.15 + (Math.random() - 0.5) * 2, 0.9, 0.7 + Math.random() * 0.4, SMOKE, 0.6, 1.5);
      }
    } else if (c.lastSk) c.lastSk = null;
    if (c.nitroOn && Math.random() < 0.5) { const sx = Math.sin(c.yaw), cz = Math.cos(c.yaw); puffs.emit(c.x - sx * car.model.L * 0.55, c.y + c.h + 0.4, c.z - cz * car.model.L * 0.55, -sx * 4, 0.5, -cz * 4, 0.3, 0.3, BLUE, 0.5, 0.8); }
  }
}

// ---------------------------------------------------------------- camera
function updateCamera(dt) {
  if (window.__zb && window.__zb.freeze) return;
  const portrait = camera.aspect < 0.8;
  if (!player) return;
  const c = player, k = 1 - Math.exp(-dt * 6);
  if (phase === 'menu' || phase === 'grid' || phase === 'results' || phase === 'garage') {
    menuA += dt * (phase === 'garage' ? 0.25 : 0.15);
    const r = phase === 'garage' ? (portrait ? 10 : 7.6) : (portrait ? 10.5 : 8.5), a = phase === 'garage' ? c.yaw + 0.9 + Math.sin(menuA) * 1.1 : c.yaw + 2.3 + Math.sin(menuA) * 0.8;
    camPos.set(c.x + Math.sin(a) * r, c.y + (phase === 'garage' ? 2.6 : 2.2), c.z + Math.cos(a) * r);
    camLook.set(c.x, c.y + (phase === 'garage' && portrait ? -1.2 : 0.8), c.z);
    if (phase === 'results') { camPos.set(c.x + Math.sin(a) * 9, c.y + 3, c.z + Math.cos(a) * 9); }
    { const q = T.locate(camPos.x, camPos.z, c.idx, { i: 0, s: 0, d: 0 }), lim = W - 1.2; if (Math.abs(q.d) > lim) { const k2 = (Math.abs(q.d) - lim) * Math.sign(q.d); camPos.x -= T.RX[q.i] * k2; camPos.z -= T.RZ[q.i] * k2; } }
    if (phase === 'garage' && !portrait) { const ra = Math.atan2(camPos.x - c.x, camPos.z - c.z) + Math.PI / 2; camLook.x += Math.sin(ra) * 1.3; camLook.z += Math.cos(ra) * 1.3; }
    lines.update(dt, 0, 0); blur.uniforms.uAmt.value = 0; blur.enabled = false;
    camera.position.lerp(camPos, phase === 'results' ? 0.05 : 0.08); camera.lookAt(camLook); camera.fov = portrait ? 62 : 50; camera.updateProjectionMatrix(); camYaw = c.yaw; return;
  }
  const back = portrait ? 7.6 : 6.3, up = portrait ? 3.0 : 2.35;
  let target = c.va * 0.65 + (c.va + wrapA(c.yaw - c.va)) * 0.35;
  if (phase === 'count') { const u = clamp(cdT / 3.2, 0, 1); target = c.yaw + u * u * 2.6; }
  camYaw += wrapA(target - camYaw) * (phase === 'count' ? 0.2 : 1 - Math.exp(-dt * 7));
  const sp = c.speed / c.st.top, ex = phase === 'count' ? clamp(cdT / 3.2, 0, 1) * 3 : 0;
  camPos.set(c.x - Math.sin(camYaw) * (back + ex), c.y + c.h * 0.7 + up + ex * 0.3, c.z - Math.cos(camYaw) * (back + ex));
  { const q = T.locate(camPos.x, camPos.z, c.idx, { i: 0, s: 0, d: 0 }), lim = W - 0.6; if (Math.abs(q.d) > lim) { const k2 = (Math.abs(q.d) - lim) * Math.sign(q.d); camPos.x -= T.RX[q.i] * k2; camPos.z -= T.RZ[q.i] * k2; } }
  camera.position.lerp(camPos, phase === 'count' ? 0.12 : 1 - Math.exp(-dt * 14));
  shake = Math.max(0, shake - dt * 2.5); const sh = shake * 0.35 + (c.nitroOn ? 0.03 : 0) + (sp > 0.85 ? 0.01 : 0);
  camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh;
  camLook.set(c.x + Math.sin(camYaw) * 5, c.y + c.h * 0.8 + 1.0, c.z + Math.cos(camYaw) * 5); camera.lookAt(camLook);
  fovKick += ((c.nitroOn ? 14 : 0) - fovKick) * Math.min(1, dt * (c.nitroOn ? 6 : 2.5));
  camera.fov = (portrait ? 70 : 58) + sp * 7 + fovKick; camera.updateProjectionMatrix();
  const amt = clamp((sp - 0.55) * 1.6, 0, 1) * 0.5 + (c.nitroOn ? 0.6 : 0);
  lines.update(dt, amt, c.speed); blur.uniforms.uAmt.value += ((c.nitroOn ? 0.07 : sp > 0.8 ? 0.025 : 0) - blur.uniforms.uAmt.value) * Math.min(1, dt * 5); blur.enabled = blur.uniforms.uAmt.value > 0.003;
  sun.position.set(c.x, c.y, c.z).addScaledVector(SUNV, 120); sun.target.position.set(c.x + Math.sin(c.yaw) * 20, c.y, c.z + Math.cos(c.yaw) * 20);
  // engine + ambience
  const g = A.engine(c.speed, c.st.top, c.in.thr, c.nitroOn, phase !== 'results'); if (g) $('gear').textContent = g;
  A.skid(c.drift ? 1 : (c.in.brk && c.speed > 15 ? 0.6 : 0)); A.wind(clamp(sp, 0, 1.3)); A.scrape(c.wall > 0 && c.speed > 8 ? 1 : 0);
}
let SUNV = new THREE.Vector3(0.4, 0.8, 0.3);

// ---------------------------------------------------------------- HUD
let mapBase = null, mapS = 1, mapO = [0, 0];
function drawMapBase() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 208; const x = cv.getContext('2d'), b = T.box, sz = Math.max(b.maxx - b.minx, b.maxz - b.minz);
  mapS = 176 / sz; mapO = [104 - (b.minx + b.maxx) / 2 * mapS, 104 - (b.minz + b.maxz) / 2 * mapS];
  x.lineCap = x.lineJoin = 'round';
  for (const [w, col] of [[16, '#1b1530'], [9, '#ffffff']]) { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); for (let i = 0; i < T.n; i += 2) { const px = mapO[0] + T.X[i] * mapS, pz = mapO[1] + T.Z[i] * mapS; i ? x.lineTo(px, pz) : x.moveTo(px, pz); } if (T.closed) x.closePath(); x.stroke(); }
  const s = T.at(T.closed ? 0 : T.finishS, {}); x.fillStyle = '#ff2d55'; x.fillRect(mapO[0] + s.x * mapS - 6, mapO[1] + s.z * mapS - 6, 12, 12);
  mapBase = cv; SUNV = sunDir(theme);
}
function hudCars() { const m = $('map').getContext('2d'); m.clearRect(0, 0, 208, 208); if (mapBase) m.drawImage(mapBase, 0, 0);
  for (const c of racers) { m.fillStyle = c.isP ? '#ffd23f' : c.color; m.strokeStyle = '#1b1530'; m.lineWidth = 3; m.beginPath(); m.arc(mapO[0] + c.x * mapS, mapO[1] + c.z * mapS, c.isP ? 8 : 6, 0, 7); m.fill(); m.stroke(); } }
let hudT = 0;
function hud(dt) {
  const c = player; if (!c) return;
  $('kmh').textContent = Math.round(c.speed * 4);
  const nb = $('nbar'); nb.firstElementChild.style.width = (c.nitro * 100) + '%'; nb.classList.toggle('full', c.nitro > 0.5); $('bn').classList.toggle('ready', c.nitro > 0.5 && !c.nitroOn);
  $('time').textContent = fmt(raceT);
  $('style').textContent = c.score > 0 ? `★ ${Math.round(c.score).toLocaleString()}${c.drift && c.chain > 30 ? `  +${Math.round(c.chain)}` : ''}` : '';
  if (spec.mode === 'ta') { $('lap').textContent = 'TIME ATTACK'; $('pos').style.display = 'none'; }
  else {
    $('pos').style.display = ''; $('lap').textContent = T.closed ? `LAP ${c.lap}/${spec.laps}` : `${Math.max(0, Math.round((raceLen - c.prog) / 10) * 10)} M TO GO`;
    const p = standings().indexOf(c) + 1; if (p !== lastPos) { if (p < lastPos && phase === 'race') { pop('OVERTAKE +100', '#2ec4ff', 28); c.score += 100; } lastPos = p; $('pos').classList.remove('pop'); void $('pos').offsetWidth; $('pos').classList.add('pop'); }
    $('pos').dataset.p = p; $('pos').innerHTML = `<b>${p}</b><span>/${racers.length}</span>`;
  }
  $('msg').textContent = c.wrong > 0.6 ? 'WRONG WAY!' : '';
  hudT += dt; if (hudT > 0.1) { hudT = 0; hudCars(); }
}

// ---------------------------------------------------------------- menu, garage, lists
const cashPill = document.createElement('div'); cashPill.className = 'cashpill zb'; document.body.appendChild(cashPill);
const paintCash = () => { cashPill.textContent = `💰 ${save.cash.toLocaleString()}`; };
const menu = document.createElement('div'); menu.id = 'menu'; menu.className = 'zb';
const tag = document.createElement('div'); tag.className = 'tag zb-o'; tag.textContent = 'STREET RACING'; ui.els.start.querySelector('h1').after(tag);
ui.els.start.querySelector('.hint').before(menu);
function showMenu() {
  phase = 'menu'; state = 'ready'; $('hud').classList.add('off'); A.music(false); A.engine(0, 1, 0, false, false); A.skid(0); A.wind(0); A.scrape(0);
  const sp = D.isDaily ? dailySpec() : eventSpec(save.event);
  setupRace(sp); phase = 'menu';
  const best = save.best[trackKey];
  menu.innerHTML = `<div class="evcard"><div class="n zb-o">${sp.mode === 'ta' ? '★' : sp.n + 1}</div><div><b>${sp.mode === 'ta' ? 'DAILY · ' : 'EVENT ' + (sp.n + 1) + ' · '}${specName(sp).toUpperCase()}</b><small>${specKind(sp)} · ${sp.mode === 'ta' ? 'beat the clock' : 'finish top 3 to advance'}${best ? ' · best ' + fmt(best) : ''}</small></div></div>
    <button class="btn big" data-a="race">RACE!</button>
    <div class="row"><button class="btn blue" data-a="garage">🔧 Garage</button><button class="btn pink" data-a="daily">⏱ Daily</button><button class="btn green" data-a="free">🗺 Tracks</button></div>
    <div class="mini">${isTouch ? `<button class="btn" data-a="steer">Steer: ${save.steer === 'tilt' ? 'Tilt' : 'Buttons'}</button>` : ''}<button class="btn" data-a="mute">Sound: ${save.mute ? 'Off' : 'On'}</button></div>`;
  for (const b of menu.querySelectorAll('button')) b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); menuAction(b.dataset.a); });
  ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); ui.start(); paintCash(); cashPill.style.display = '';
}
function menuAction(a) {
  A.init();
  if (a === 'race') { ui.hideStart(); startCountdown(); }
  if (a === 'daily') { setupRace(dailySpec()); ui.hideStart(); startCountdown(); }
  if (a === 'garage') openGarage();
  if (a === 'free') openTracks();
  if (a === 'mute') { save.mute = !save.mute; A.mute(save.mute); persist(); showMenu(); }
  if (a === 'steer') {
    save.steer = save.steer === 'tilt' ? 'buttons' : 'tilt'; persist();
    if (save.steer === 'tilt' && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {});
    $('ctl').classList.toggle('tilt', save.steer === 'tilt'); showMenu();
  }
}
const sheet = document.createElement('div'); sheet.className = 'sheet zb'; sheet.hidden = true; document.body.appendChild(sheet);
['pointerdown', 'touchstart', 'mousedown'].forEach(t => sheet.addEventListener(t, e => e.stopPropagation()));
function closeSheets() { sheet.hidden = true; if (phase === 'garage') phase = 'menu'; }
function openTracks() {
  ui.hideStart(); sheet.hidden = false;
  const items = [];
  TRACKS.forEach((t, i) => { for (const rev of [false, true]) items.push({ t: i, rev }); });
  sheet.innerHTML = `<div class="carsel"><div class="nm"><b class="zb-o">PICK A TRACK</b><small>Free race vs 5 rivals</small></div><button class="btn" data-x>✕</button></div><div class="tl">${items.map((it, k) => `<button class="btn ${k % 2 ? '' : 'blue'}" data-k="${k}"><span>${TRACKS[it.t].name}${it.rev ? ' ⟲' : ''}</span><small>${TRACKS[it.t].kind === 'sprint' ? 'Sprint' : TRACKS[it.t].laps + ' laps'}</small></button>`).join('')}</div>`;
  sheet.querySelector('[data-x]').onpointerdown = () => { sheet.hidden = true; ui.start(); };
  sheet.querySelectorAll('[data-k]').forEach(b => b.onpointerdown = () => { const it = items[+b.dataset.k]; sheet.hidden = true; setupRace({ mode: 'quick', t: it.t, rev: it.rev, tier: clamp(1 + Math.floor(save.event / 2), 1, 5), n: 50 + +b.dataset.k }); startCountdown(); });
}
let gTab = 'car', gIdx = 0;
const STYLE_COST = { paint: 300, finish: [0, 500, 1200, 400], rim: 400, livery: 250 };
function openGarage() {
  ui.hideStart(); sheet.hidden = false; phase = 'garage'; gIdx = MODELS.findIndex(m => m.id === save.car); renderGarage();
}
function showPreview(id) {
  if (!player) return; const old = player.car; const look = lookOf(id);
  const car = makeCar(MODEL[id], look, pool, {}); scene.add(car.root); player.car = car; disposeCar(old);
  pool.clear(); for (const c of racers.concat(traffic)) for (const w of c.car.wheels) w.idx = pool.add(w.spin, c.car.model.R, c.car.look.rim || '#d8dce4');
  updateCars(0);
}
function renderGarage() {
  const m = MODELS[gIdx], own = save.owned.includes(m.id), cur = save.car === m.id, st = statsFor(m.id), base = statsFor(m.id, { e: 0, n: 0, h: 0 });
  if (player && player.car.model.id !== m.id) showPreview(m.id);
  const bar = (lbl, v, b, mx) => `<div class="stat"><span>${lbl}</span><div class="bar"><i class="${v > b + 1e-6 ? 'up' : ''}" style="width:${clamp(v / mx * 100, 5, 100)}%"></i></div></div>`;
  let body = '';
  if (gTab === 'car') body = `<div class="carsel"><button class="btn" data-p>◀</button><div class="nm"><b class="zb-o">${m.name}</b><small>${own ? (cur ? 'DRIVING' : 'OWNED') : '💰 ' + m.price.toLocaleString()}</small></div><button class="btn" data-n>▶</button></div>
      ${bar('Speed', st.top, base.top, 80)}${bar('Accel', st.acc, base.acc, 19)}${bar('Handling', st.hand, base.hand, 1.4)}${bar('Nitro', st.nos, base.nos, 2)}
      ${own ? (cur ? '' : '<button class="btn big" data-sel>DRIVE THIS</button>') : `<button class="btn big" data-buy ${save.cash < m.price ? 'disabled style="opacity:.5"' : ''}>BUY 💰 ${m.price.toLocaleString()}</button>`}`;
  else if (!own) body = '<p class="zb-o" style="margin:10px 0;text-align:center">Buy this car first.</p>';
  else if (gTab === 'perf') { const t = tuneOf(m.id); body = [['e', 'Engine', 'top speed + acceleration'], ['n', 'Nitro', 'longer, stronger boost'], ['h', 'Grip', 'sharper steering + drifts']].map(([k, n, d], i) => {
      const lvl = t[k], cost = Math.round((300 + 260 * lvl * lvl) * (1 + MODELS.indexOf(m) * 0.3) / 50) * 50;
      return `<div class="upg"><div><b>${n}</b> <small style="opacity:.8">${d}</small><div class="pips">${[0, 1, 2, 3, 4].map(q => `<i class="${q < lvl ? 'on' : ''}"></i>`).join('')}</div></div>${lvl < 5 ? `<button class="btn ${save.cash >= cost ? 'green' : ''}" data-up="${k}" data-c="${cost}">💰 ${cost.toLocaleString()}</button>` : '<b style="color:#ffd23f">MAX</b>'}</div>`; }).join('') + bar('Speed', st.top, base.top, 80) + bar('Handling', st.hand, base.hand, 1.4); }
  else { const lk = lookOf(m.id);
    body = `<div class="lbl">PAINT · 💰 ${STYLE_COST.paint}</div><div class="sw">${PAINTS.map(([n, c]) => `<button title="${n}" data-paint="${c}" class="${lk.paint === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
      <div class="lbl">FINISH</div><div class="chips">${FINISHES.map((f, i) => `<button class="btn ${lk.finish === i ? 'on' : ''}" data-fin="${i}">${f}${STYLE_COST.finish[i] ? ' · ' + STYLE_COST.finish[i] : ''}</button>`).join('')}</div>
      <div class="lbl">RIMS · 💰 ${STYLE_COST.rim}</div><div class="sw">${RIMS.map(([n, c]) => `<button title="${n}" data-rim="${c}" class="${lk.rim === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
      <div class="lbl">LIVERY · 💰 ${STYLE_COST.livery}</div><div class="chips">${LIVERIES.map((f, i) => `<button class="btn ${lk.livery === i ? 'on' : ''}" data-liv="${i}">${f}</button>`).join('')}</div>
      <div class="lbl">STRIPE COLOUR · 💰 ${STYLE_COST.livery}</div><div class="sw">${['#ffffff', '#1b1530', '#ffd23f', '#ff4a6e', '#2ec4ff'].map(c => `<button data-acc="${c}" class="${lk.accent === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>`; }
  sheet.innerHTML = `<div class="tabs"><button class="btn ${gTab === 'car' ? 'on' : ''}" data-t="car">CARS</button><button class="btn ${gTab === 'perf' ? 'on' : ''}" data-t="perf">TUNE</button><button class="btn ${gTab === 'style' ? 'on' : ''}" data-t="style">STYLE</button><button class="btn pink" data-x style="flex:.6">✕</button></div>${body}`;
  const on = (s, f) => sheet.querySelectorAll(s).forEach(b => b.onpointerdown = e => { e.preventDefault(); A.init(); f(b); });
  on('[data-t]', b => { gTab = b.dataset.t; renderGarage(); });
  on('[data-x]', () => { sheet.hidden = true; if (!save.owned.includes(MODELS[gIdx].id) || player.car.model.id !== save.car) showPreview(save.car); phase = 'menu'; showMenu(); });
  on('[data-p]', () => { gIdx = (gIdx + MODELS.length - 1) % MODELS.length; renderGarage(); A.pop(0); });
  on('[data-n]', () => { gIdx = (gIdx + 1) % MODELS.length; renderGarage(); A.pop(1); });
  on('[data-sel]', () => { save.car = m.id; persist(); A.cash(); renderGarage(); });
  on('[data-buy]', () => { if (save.cash < m.price) return; save.cash -= m.price; save.owned.push(m.id); save.car = m.id; persist(); A.cash(); paintCash(); confetti(scene, new THREE.Vector3(player.x, player.y + 2.5, player.z), 60); renderGarage(); });
  on('[data-up]', b => { const c = +b.dataset.c; if (save.cash < c) { A.lose(); return; } save.cash -= c; tuneOf(m.id)[b.dataset.up]++; persist(); paintCash(); A.cash(); player.st = statsFor(m.id); renderGarage(); });
  const buyStyle = (cost, f) => { if (save.cash < cost) { A.lose(); return; } save.cash -= cost; f(lookOf(m.id)); persist(); paintCash(); A.cash(); player.car.setLook(lookOf(m.id)); renderGarage(); };
  on('[data-paint]', b => lookOf(m.id).paint !== b.dataset.paint && buyStyle(STYLE_COST.paint, l => l.paint = b.dataset.paint));
  on('[data-fin]', b => lookOf(m.id).finish !== +b.dataset.fin && buyStyle(STYLE_COST.finish[+b.dataset.fin], l => l.finish = +b.dataset.fin));
  on('[data-rim]', b => lookOf(m.id).rim !== b.dataset.rim && buyStyle(STYLE_COST.rim, l => l.rim = b.dataset.rim));
  on('[data-liv]', b => lookOf(m.id).livery !== +b.dataset.liv && buyStyle(STYLE_COST.livery, l => l.livery = +b.dataset.liv));
  on('[data-acc]', b => lookOf(m.id).accent !== b.dataset.acc && buyStyle(STYLE_COST.livery, l => l.accent = b.dataset.acc));
  paintCash();
}

// ---------------------------------------------------------------- boot
if (!isTouch) { $('ctl').classList.add('desk'); $('keys').classList.add('on'); }
if (save.steer === 'tilt') $('ctl').classList.add('tilt');
resize(); showMenu(); requestAnimationFrame(frame);

window.__zb = { renderer, scene, get world() { return world; }, get T() { return T; }, camera, showPreview, get player() { return player; } };
window.__game = {
  get state() { return state; }, get level() { return save.event + 1; }, get score() { return player ? Math.round(player.score) : 0; },
  bot() { botUntil = performance.now() + 450; },
  dbgP() { const c = player; return JSON.stringify({ x: c.x, z: c.z, yaw: c.yaw, va: c.va, sp: c.speed, st: c.st, inp: c.in, s: c.s, d: c.d, idx: c.idx }); },
  debug() { return { phase, raceT, raceLen, racers: racers.map(c => ({ n: c.name, prog: Math.round(c.prog), v: +c.speed.toFixed(1), d: +c.d.toFixed(1), fin: c.finished, dr: c.drift, no: c.nitroOn, ni: +c.nitro.toFixed(2), bl: c.ai.bl, w: c.wall > 0 ? 1 : 0 })) }; },
};

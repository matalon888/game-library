// Pulse Prism — original endless rhythm runner. A glowing crystal prism races down a neon runway; every spike, pit,
// stair and launch pad is placed on the beat of the music, so tapping in time is how you survive. Each song is a new
// section that plays a little faster. Our own code/art; songs are public-domain or originals (see README).
import { THREE, createStage, createUI, store, loop, input, buzz, tone, burst, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { audio, synth, createPlayer } from './_music/conductor.js';
import { SONG, arrange } from './_music/songs.js';
import { glowSprite, glowTex, skyDome, starField, sparks as sparkPool } from './_music/fx.js';

const NAME = 'Pulse Prism: Rhythm Runner';
const U = 4;                         // runway units per beat (jump = 1 beat = U units, whatever the tempo)
const JUMP_H = 1.7, PAD_H = 3.6;     // jump heights
const ORDER = ['starlight', 'cancan', 'mountain', 'neon', 'turkish', 'ode'];
const THEMES = [
  { neon: '#27f3ff', spike: '#ff3ad9', sky: ['#120437', '#ff3d9a', '#22073f'], grid: '#ff4fd8' },
  { neon: '#ffe14d', spike: '#ff4b4b', sky: ['#06123a', '#ff7a3d', '#1a0636'], grid: '#ff9a3d' },
  { neon: '#7dff6a', spike: '#ffb02e', sky: ['#061a2e', '#17c4a8', '#0b1030'], grid: '#2effc4' },
  { neon: '#ff6af0', spike: '#5af0ff', sky: ['#180430', '#7a3dff', '#0d0220'], grid: '#b07bff' },
  { neon: '#ffffff', spike: '#ff2e63', sky: ['#1e0018', '#ff2e63', '#120010'], grid: '#ff2e63' },
];

const S = store('pulseprism');
let best = S.get('best', 0);
const F = flow('pulseprism', { par: 40, warmup: 10 });

const stage = createStage({ fov: 50, shadows: false, clear: '#14063a' });
const { scene, camera, renderer } = stage;
stage.hemi.intensity = 0.9; stage.hemi.color.set('#d8c8ff'); stage.hemi.groundColor.set('#40205a'); stage.sun.intensity = 1.1;
const ui = createUI({ title: 'PULSE<br>PRISM', hint: 'Tap on the beat to jump', hand: '👆' });
const D = daily('pulseprism', ui, { name: NAME });
// the win card doubles as the "new best" card in this endless game
ui.els.win.querySelector('h1').textContent = 'NEW BEST!';
ui.els.win.querySelector('p').innerHTML = 'SCORE <span data-l></span>';
const fader = createPlayer();

// ---------------------------------------------------------------- backdrop: sky, stars, sun, neon grid
const sky = skyDome(...THEMES[0].sky, 260); scene.add(sky);
const stars = starField(380, 240, '#ffffff', 1.6, 0.05); scene.add(stars);
scene.fog = new THREE.Fog('#2a0a4a', 40, 150);
const sunTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#fff36b'); gr.addColorStop(0.55, '#ff8a3d'); gr.addColorStop(1, '#ff2e8a');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) { const y = 140 + i * 17, h = 3 + i * 1.6; g.fillRect(0, y, 256, h); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false })); sun.scale.setScalar(70); scene.add(sun);
const sunGlow = glowSprite('#ff5aa8', 170, 'soft', 0.55); sunGlow.material.fog = false; scene.add(sunGlow);
const gridMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { color: { value: new THREE.Color(THEMES[0].grid) }, pulse: { value: 0 }, cam: { value: new THREE.Vector3() } },
  vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position,1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform vec3 color; uniform float pulse; uniform vec3 cam; varying vec3 wp;
    void main(){ vec2 c = wp.xz / 4.0; vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c); float l = 1.0 - min(min(g.x, g.y), 1.0);
      float d = length(wp.xz - cam.xz); float fade = 1.0 - smoothstep(30.0, 140.0, d);
      gl_FragColor = vec4(color * (0.8 + pulse * 0.9), l * fade * (0.55 + pulse * 0.45) + fade * 0.05); }`,
});
const grid = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), gridMat); grid.position.y = -5; scene.add(grid);
// low-poly wire mountains on the horizon (parallax)
const mtnGeo = new THREE.ConeGeometry(14, 16, 4, 1, true);
const mtnMat = new THREE.MeshBasicMaterial({ color: THEMES[0].grid, wireframe: true, transparent: true, opacity: 0.35, fog: false });
const mtns = new THREE.InstancedMesh(mtnGeo, mtnMat, 14); mtns.frustumCulled = false; scene.add(mtns);
const mtnD = Array.from({ length: 14 }, (_, i) => ({ a: i / 14, s: 0.6 + Math.random() * 0.9 }));

// ---------------------------------------------------------------- hero: faceted crystal prism + inner glow + ribbon
const hero = new THREE.Group(); scene.add(hero);
const prismGeo = new THREE.OctahedronGeometry(0.42, 0); prismGeo.scale(1, 1.15, 0.82);
const prism = new THREE.Mesh(prismGeo, new THREE.MeshStandardMaterial({ color: '#a8f6ff', emissive: '#18c8ff', emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.3, flatShading: true }));
const prismEdge = new THREE.LineSegments(new THREE.EdgesGeometry(prismGeo), new THREE.LineBasicMaterial({ color: '#ffffff' }));
const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
const spin = new THREE.Group(); spin.add(prism, prismEdge, core); spin.position.y = 0.46; hero.add(spin);
const halo = glowSprite('#4ff4ff', 2.2, 'soft', 0.8); halo.material.depthTest = false; halo.renderOrder = 5; halo.position.y = 0.46; hero.add(halo);
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex('soft'), color: '#4ff4ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(shadowBlob);
const TR = 22, trailPts = [];
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 2 * 3), 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TR * 2 * 3), 3));
const tIdx = []; for (let i = 0; i < TR - 1; i++) { const a = i * 2; tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(tIdx);
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
trail.frustumCulled = false; scene.add(trail);
const sparks = sparkPool(scene, 140);

// ---------------------------------------------------------------- level pieces
const SPK = 260;
const spikeGeo = new THREE.ConeGeometry(0.42, 0.9, 4, 1); spikeGeo.rotateY(Math.PI / 4); spikeGeo.translate(0, 0.45, 0);
const spikes = new THREE.InstancedMesh(spikeGeo, new THREE.MeshStandardMaterial({ color: '#2a0838', emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.2, flatShading: true, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }), SPK);
const spikeWire = new THREE.InstancedMesh(spikeGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, fog: false }), SPK);
spikes.frustumCulled = spikeWire.frustumCulled = false; scene.add(spikes, spikeWire);
const BL = 400;
const beatLines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.02, 2.5), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), BL);
beatLines.frustumCulled = false; scene.add(beatLines);
const boxGeo = new THREE.BoxGeometry(1, 1, 1), edgeGeo = new THREE.EdgesGeometry(boxGeo);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();

// ---------------------------------------------------------------- run state
let state = 'ready', R = rng(1), sections = [], events = [], evI = 0, songT = -2, perf0 = 0, alive = true;
let spikeList = [], blockList = [], pitList = [], padList = [], beatList = [], taps = [], meshes = [];
let hx = 0, hy = 0, vy = 0, grounded = true, holding = false, buffer = -9, score = 0, beatI = 0, recorded = false, beatenShown = false;
let rotZ = 0, rotTarget = 0, squash = 0, pulse = 0, curSec = 0, perfectRun = 0, camY = 1, deadT = 0, newBest = false, theme = THEMES[0];
let botPending = false, lastBot = -99;

const secAt = (t) => { let s = sections[0]; for (const q of sections) if (q.t0 <= t) s = q; return s; };
const xAt = (t) => { const s = secAt(t); return s.x0 + (t - s.t0) * s.v; };

function makeMat(th) {
  return {
    slab: new THREE.MeshStandardMaterial({ color: '#160828', emissive: '#2a0b4a', emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.6 }),
    neon: new THREE.MeshBasicMaterial({ color: th.neon, fog: false }),
    block: new THREE.MeshStandardMaterial({ color: '#2b1150', emissive: th.neon, emissiveIntensity: 0.12, roughness: 0.3, metalness: 0.3 }),
    line: new THREE.LineBasicMaterial({ color: th.neon, fog: false }),
    pad: new THREE.MeshBasicMaterial({ color: '#ffe94d', fog: false }),
  };
}
function addMesh(geo, m, x, y, z, sx, sy, sz) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); scene.add(o); meshes.push(o); return o; }

// build one section = one whole song, obstacles on its beats
function buildSection() {
  const k = sections.length, prev = sections[k - 1];
  const fk = F.k(score);
  // each section = one half of a song (≈8 bars), songs rotate every two sections
  const song = SONG[ORDER[(Math.floor(k / 2) + (D.seed ? D.seed % ORDER.length : 0)) % ORDER.length]];
  const tempo = clamp((1 + 0.035 * k) * fk, 0.8, 1.5);
  const full = arrange(song, { tempo }), hb = Math.ceil(song.nBars / 2), half = k % 2;
  const c0 = full.barTimes[half * hb], c1 = half ? full.length : full.barTimes[hb];
  const cut = (e) => e.t >= c0 - 1e-6 && e.t < c1 - 1e-6, sh = (e) => ({ ...e, t: e.t - c0 });
  const tr = { acc: full.acc.filter(cut).map(sh), melody: full.melody.filter(cut).map(sh), beats: full.beats.filter(cut).map(sh), length: c1 - c0 };
  const beatSec = 60 / (song.bpm * tempo), v = U / beatSec;
  const t0 = prev ? prev.t0 + prev.dur : 0, x0 = prev ? prev.x0 + prev.dur * prev.v : 0;
  const sec = { k, song, t0, x0, v, beatSec, dur: tr.length, th: THEMES[k % THEMES.length], g: 8 * JUMP_H / (beatSec * beatSec) };
  sec.mat = makeMat(sec.th); sections.push(sec);
  // music events
  const evs = [];
  for (const e of tr.acc) evs.push({ ...e, t: t0 + e.t });
  for (const n of tr.melody) evs.push({ t: t0 + n.t, kind: 'mel', midi: n.midi, dur: n.dur });
  if (k === 0) for (let i = 1; i <= 4; i++) evs.push({ t: -i * beatSec * 0.5, kind: 'tick' });
  evs.sort((a, b) => a.t - b.t); events.push(...evs);
  // obstacles
  const beats = tr.beats.map(b => t0 + b.t), N = beats.length, X = (i) => x0 + (beats[i] - t0) * v;
  const Dn = clamp((0.3 + 0.17 * k) * fk, 0.2, 1.3);
  const pits = [], secSpikes = [];
  const spike = (x, y = 0) => { const s = { x, y, sec: k }; spikeList.push(s); secSpikes.push(s); };
  let i = k === 0 ? 4 : 2, lastRest = 2;
  const end = N - 3;
  while (i < end) {
    const opts = [['spike', 3]];
    if (Dn > 0.2) opts.push(['double', 2]);
    if (Dn > 0.25) opts.push(['pit', 1.5]);
    if (Dn > 0.3) opts.push(['block', 1.5]);
    if (Dn > 0.35 && lastRest >= 1) opts.push(['pad', 1.1]);
    if (Dn > 0.5) opts.push(['stairs', 1]);
    if (Dn > 0.6) opts.push(['triple', 1.2]);
    let tot = opts.reduce((a, o) => a + o[1], 0), r = R() * tot, kind = 'spike';
    for (const o of opts) { if ((r -= o[1]) < 0) { kind = o[0]; break; } }
    let span = 1; const b = i, xb = X(b);
    const need = { block: 4, stairs: 5, pad: 2 }[kind] || 1;
    if (b + need >= end) kind = 'spike';
    if (kind === 'spike') { spike(xb + 2); taps.push(beats[b]); }
    else if (kind === 'double') { spike(xb + 1.6); spike(xb + 2.4); taps.push(beats[b]); }
    else if (kind === 'triple') { spike(xb + 1.3); spike(xb + 2.0); spike(xb + 2.7); taps.push(beats[b]); }
    else if (kind === 'pit') { const p = { x0: xb + 1.0, x1: xb + (Dn > 0.75 ? 3.4 : 3.0) }; pitList.push(p); pits.push(p); taps.push(beats[b]); }
    else if (kind === 'block') {
      const L = Dn > 0.55 && R() < 0.6 ? 3 : 2, bl = { x0: xb + 1.5, x1: X(b + L) + 1, top: 1, sec: k }; blockList.push(bl); taps.push(beats[b]);
      if (L === 3) { spike(X(b + 2) + 2, 1); taps.push(beats[b + 2]); }
      span = L + 1;
    } else if (kind === 'stairs') {
      const n = Dn > 0.8 ? 3 : 2;
      for (let j = 0; j < n; j++) { blockList.push({ x0: X(b + j) + 1.5, x1: j === n - 1 ? X(b + n) + 4 : X(b + j + 1) + 1.5, top: j + 1, sec: k }); taps.push(beats[b + j]); }
      span = n + 2;
    } else if (kind === 'pad') {
      padList.push({ x0: xb - 0.3, x1: xb + 0.3, used: false, sec: k });
      for (let j = 0; j < 4; j++) spike(xb + 1.5 + j * 0.8);
      span = 2;
    }
    const rest = Math.max(0, Math.round(lerp(3, 0.3, clamp(Dn, 0, 1)) + (R() - 0.5) * 2));
    lastRest = rest; i = b + span + rest;
  }
  // runway slabs between pits (+ neon edges), blocks, pads
  const xs = k === 0 ? -60 : x0, xe = x0 + tr.length * v;
  let cur = xs; const segs = [];
  for (const p of pits.sort((a, c) => a.x0 - c.x0)) { segs.push([cur, p.x0]); cur = p.x1; } segs.push([cur, xe]);
  const M = sec.mat;
  for (const [a, c] of segs) {
    const L = c - a, mx = (a + c) / 2;
    addMesh(boxGeo, M.slab, mx, -0.35, 0, L, 0.7, 2.6);
    addMesh(boxGeo, M.neon, mx, 0.0, 1.3, L, 0.07, 0.07); addMesh(boxGeo, M.neon, mx, 0.0, -1.3, L, 0.07, 0.07);
    addMesh(boxGeo, M.neon, a, -0.35, 1.31, 0.07, 0.7, 0.04); addMesh(boxGeo, M.neon, c, -0.35, 1.31, 0.07, 0.7, 0.04);
  }
  for (const bl of blockList) if (bl.sec === k) {
    const w = bl.x1 - bl.x0, h = bl.top + 3, mx = (bl.x0 + bl.x1) / 2, my = bl.top - h / 2;
    addMesh(boxGeo, M.block, mx, my, 0, w, h, 2.2);
    { const l = new THREE.LineSegments(edgeGeo, M.line); l.position.set(mx, my, 0); l.scale.set(w, h, 2.2); scene.add(l); meshes.push(l); }
    addMesh(boxGeo, M.neon, mx, bl.top, 1.11, w, 0.06, 0.06); addMesh(boxGeo, M.neon, mx, bl.top, -1.11, w, 0.06, 0.06);
    addMesh(boxGeo, M.neon, bl.x0, bl.top, 0, 0.06, 0.06, 2.2);
  }
  for (const pd of padList) if (pd.sec === k) {
    const m = addMesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 20), M.pad, (pd.x0 + pd.x1) / 2, 0.06, 0, 1, 1, 1);
    const gs = glowSprite('#ffe94d', 2.2, 'soft', 0.9); gs.position.set((pd.x0 + pd.x1) / 2, 0.3, 0); scene.add(gs); meshes.push(gs); pd.mesh = m;
  }
  // beat lines on solid runway
  for (let j = 0; j < N; j++) { const x = X(j); if (pits.some(p => x > p.x0 - 0.1 && x < p.x1 + 0.1)) continue; beatList.push({ x, t: beats[j], c: sec.th.neon, y: 0.005 }); }
}

function reset() {
  for (const o of meshes) scene.remove(o); meshes = [];
  sections = []; events = []; evI = 0; spikeList = []; blockList = []; pitList = []; padList = []; beatList = []; taps = [];
  R = rng(D.seed || (Date.now() % 1000003) + 11);
  score = 0; beatI = 0; recorded = false; beatenShown = false; newBest = false; alive = true; perfectRun = 0; curSec = 0; botPending = false; lastBot = -99;
  buildSection(); buildSection();
  const s0 = sections[0]; songT = -2 * s0.beatSec;
  hx = xAt(songT); hy = 0; vy = 0; grounded = true; buffer = -9; rotZ = rotTarget = 0; camY = 1; deadT = 0;
  hero.visible = true; trailPts.length = 0; sparks.clear();
  setTheme(s0.th, 1);
  ui.score(0); ui.levels(1); ui.progress(0); ui.sub(best ? 'BEST ' + best : ''); ui.pill(D.isDaily ? 'DAILY' : '');
}
let skyCols = THEMES[0].sky.map(c => new THREE.Color(c));
function setTheme(th, a = 0.04) {
  theme = th;
  const u = sky.uniforms; [u.top.value, u.mid.value, u.bot.value].forEach((v, i) => v.lerp(_c.set(th.sky[i]), a));
  gridMat.uniforms.color.value.lerp(_c.set(th.grid), a); mtnMat.color.lerp(_c.set(th.grid), a);
  scene.fog.color.copy(u.mid.value).lerp(_c.set(th.sky[2]), 0.55);
}

// ---------------------------------------------------------------- input
function jump(fromTap) {
  if (state !== 'play' || !alive) return;
  if (grounded) doJump(fromTap); else buffer = songT;
}
function doJump(fromTap) {
  const s = secAt(songT); vy = Math.sqrt(2 * s.g * JUMP_H); grounded = false; buffer = -9;
  rotTarget -= Math.PI / 2 * 2; squash = 1; buzz(8);
  tone(880, 0.05, 'triangle', 0.05, 1.4);
  if (fromTap) {   // timing vs. the beat grid: perfect taps chain a combo
    const ph = ((songT - s.t0) / s.beatSec) % 1, off = Math.min(ph, 1 - ph) * s.beatSec;
    if (off < 0.06) { perfectRun++; if (perfectRun >= 3 && perfectRun % 3 === 0) ui.pop(`PERFECT ×${perfectRun}`, s.th.neon, 30, 26); sparks.emit(new THREE.Vector3(hx, hy + 0.1, 0), [s.th.neon, '#ffffff'], 8, { speed: 0.06, size: 0.35, up: 0.02 }); }
    else perfectRun = 0;
  }
}
input({ onDown: () => { holding = true; jump(true); }, onUp: () => { holding = false; } });
addEventListener('pointercancel', () => holding = false);
ui.onTap(which => { reset(); state = 'play'; perf0 = performance.now() / 1000 - songT; audio(); ui.els.sc.classList.remove('hc-hidden'); holding = false; });

// ---------------------------------------------------------------- physics (sub-stepped, x is driven by the song clock)
function supportAt(x) {
  let s = -99;
  const onPit = pitList.some(p => x - 0.2 > p.x0 && x + 0.2 < p.x1);
  if (!onPit) s = 0;
  for (const b of blockList) if (x + 0.24 > b.x0 && x - 0.24 < b.x1) s = Math.max(s, b.top);
  return s;
}
function step(h) {
  const s = secAt(songT); hx = xAt(songT);
  if (grounded) {
    const sup = supportAt(hx);
    if (sup < hy - 0.01) { grounded = false; vy = 0; }
    else hy = sup;
    if (grounded) for (const p of padList) if (!p.used && hx + 0.2 > p.x0 && hx - 0.2 < p.x1 && hy < 0.05) {
      p.used = true; vy = Math.sqrt(2 * s.g * PAD_H); grounded = false; rotTarget -= Math.PI * 2; squash = 1.2;
      tone(520, 0.25, 'sine', 0.12, 2.2); buzz(15); ui.flash(0.25);
      sparks.emit(new THREE.Vector3(hx, 0.2, 0), ['#ffe94d', '#ffffff'], 16, { speed: 0.1, size: 0.5, up: 0.08 });
      if (p.mesh) p.mesh.scale.set(1.5, 3, 1.5);
    }
    if (grounded && (holding || songT - buffer < 0.14)) doJump(false);
  } else {
    const py = hy; vy -= s.g * h; hy += vy * h;
    if (vy <= 0) {
      const sup = supportAt(hx);
      if (sup > -50 && py >= sup - 0.02 && hy <= sup) {
        hy = sup; vy = 0; grounded = true; squash = -0.8; rotTarget = Math.round(rotTarget / (Math.PI / 2)) * (Math.PI / 2);
        sparks.emit(new THREE.Vector3(hx, hy + 0.05, 0), [s.th.neon, '#ffffff'], 6, { speed: 0.05, size: 0.3, up: 0.02, gravity: 0.003 });
        if (holding || songT - buffer < 0.14) doJump(false);
      }
    }
  }
  // hazards
  for (const sp of spikeList) {
    const dx = Math.abs(hx - sp.x); if (dx > 0.7) continue;
    const ed = Math.max(0, dx - 0.2), top = sp.y + 0.9 * (1 - ed / 0.42) - 0.16;
    if (ed < 0.42 && hy < top && hy + 0.75 > sp.y) return die('spike');
  }
  for (const b of blockList) if (hx + 0.27 > b.x0 && hx - 0.27 < b.x1 && hy + 0.7 > -3 && hy + 0.06 < b.top - 0.15) return die('block');
  if (hy < -1.6) return die('pit');
}
function die() {
  if (!alive) return;
  alive = false; deadT = 0; hero.visible = false;
  const pos = new THREE.Vector3(hx, hy + 0.46, 0);
  shatter(pos);
  sparks.emit(pos, [theme.neon, '#ffffff', theme.spike], 12, { speed: 0.06, size: 0.3, up: 0.03 });
  ui.flash(0.75); buzz([40, 30, 80]); synth.fail(); fader.stop(0.35);
  ui.sub('');
  if (!recorded) { recorded = true; F.endless(score); }
  newBest = score > best && score > 0;
  if (newBest) { best = score; S.set('best', best); }
  setTimeout(() => {
    if (newBest) { state = 'won'; D.won(score); ui.win(score, `${sections[curSec].song.title} · song ${curSec + 1}`); confetti2(); }
    else { state = 'lost'; ui.lose(String(score), `BEST ${best}`); }
    ui.els.sc.classList.add('hc-hidden');
  }, 380);
}
const shards = [], shardGeo = new THREE.TetrahedronGeometry(0.16, 0);
const shardMats = ['#c9fbff', '#4ff4ff', '#ffffff', '#9fe8ff'].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true }));
function shatter(pos) {
  for (const o of shards) scene.remove(o.m); shards.length = 0;
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(shardGeo, shardMats[i % 4].clone()); m.position.copy(pos); m.scale.setScalar(0.6 + Math.random() * 1.2); scene.add(m);
    const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.4;
    shards.push({ m, v: new THREE.Vector3(Math.cos(a) * Math.cos(e) * 5 + 2, Math.sin(e) * 5 + 3, Math.sin(a) * Math.cos(e) * 5), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), life: 1 });
  }
}
function updShards(sec) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const o = shards[i]; o.v.y -= 14 * sec; o.m.position.addScaledVector(o.v, sec); o.m.rotation.x += o.r.x * sec; o.m.rotation.y += o.r.y * sec;
    if (o.m.position.y < 0.05 && o.v.y < 0 && supportAt(o.m.position.x) > -50) { o.m.position.y = 0.05; o.v.y *= -0.4; o.v.x *= 0.7; o.v.z *= 0.7; }
    o.life -= sec * 0.6; o.m.material.opacity = Math.max(0, o.life);
    if (o.life <= 0) { scene.remove(o.m); shards.splice(i, 1); }
  }
}
function confetti2() { sparks.emit(new THREE.Vector3(hx + 3, hy + 2, 0), ['#ff3ad9', '#27f3ff', '#ffe14d', '#ffffff'], 40, { speed: 0.2, size: 0.6, up: 0.1 }); }

// ---------------------------------------------------------------- audio pump (look-ahead on the audio clock)
function pump() {
  if (state !== 'play' || !alive) return;
  const c = audio(), horizon = songT + 0.15;
  while (evI < events.length && events[evI].t < horizon) {
    const e = events[evI++], at = c.currentTime + Math.max(0, e.t - songT), v = e.vol ?? 1;
    switch (e.kind) {
      case 'mel': synth.piano(e.midi, at, e.dur, 0.2 * v); break;
      case 'bass': synth.bass(e.midi, at, e.dur, 0.2 * v); break;
      case 'pad': synth.pad(e.midi, at, e.dur, 0.03); break;
      case 'kick': synth.kick(at, 0.85 * v); break;
      case 'snare': synth.snare(at, 0.9 * v); break;
      case 'hat': synth.hat(at, v); break;
      case 'crash': synth.crash(at, v); break;
      case 'tick': synth.hat(at, 1.4); break;
    }
  }
}
setInterval(pump, 25);

// ---------------------------------------------------------------- loop
let clock = 0;
loop((dt) => {
  const sec = dt / 60; clock += sec;
  if (state === 'play' && alive) {
    const target = performance.now() / 1000 - perf0;
    let t = songT; const total = Math.min(0.1, target - t);
    const n = Math.max(1, Math.ceil(total / (1 / 240)));
    for (let k = 0; k < n && alive; k++) { songT = t + total * (k + 1) / n; step(total / n); }
    songT = Math.max(songT, target - 0.1);
    pump();
    // beats → score + pulse
    const all = beatList;
    while (beatI < all.length && all[beatI].t <= songT) {
      if (all[beatI].t >= 0) {
        score++; ui.score(score); pulse = 1; ui.els.sc.classList.add('beat'); setTimeout(() => ui.els.sc.classList.remove('beat'), 90);
        if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti2(); }
      }
      beatI++;
    }
    const s = secAt(songT);
    if (s.k !== curSec) {
      curSec = s.k; ui.levels(curSec + 1);
      ui.pop(`♪ ${s.song.title}`, s.th.neon, 28, 26); setTimeout(() => state === 'play' && alive && ui.pop('SPEED UP!', '#fff', 36, 31), 900);
      sparks.emit(new THREE.Vector3(hx, hy + 0.5, 0), [s.th.neon, '#ffffff'], 24, { speed: 0.15, size: 0.6, up: 0.05 });
    }
    ui.progress((songT - s.t0) / s.dur);
    const ls = sections[sections.length - 1]; if (ls.t0 + ls.dur - songT < 12) buildSection();
    // prune passed pieces
    const cut = hx - 25;
    if (spikeList.length && spikeList[0].x < cut) spikeList = spikeList.filter(o => o.x > cut);
    if (taps.length && taps[0] < songT - 1) taps = taps.filter(tt => tt > songT - 1);
  } else if (state === 'play' || state === 'lost' || state === 'won') {
    deadT += sec;
  } else {   // ready: idle prism on the runway
    hx = xAt(songT); hy = 0;
  }
  if (state === 'ready' || !alive) rotZ += 0;
  setTheme(secAt(songT).th);
  document.body.style.setProperty('--glow', theme.neon); document.body.style.setProperty('--ui', theme.spike);
  // hero visuals
  rotZ = lerp(rotZ, rotTarget, clamp(dt * 0.25, 0, 1));
  if (state === 'ready') spin.rotation.y += sec * 1.6; else spin.rotation.y = lerp(spin.rotation.y, 0.35, 0.1);
  spin.rotation.z = rotZ;
  squash = lerp(squash, 0, clamp(dt * 0.18, 0, 1));
  spin.scale.set(1 + squash * -0.18, 1 + squash * 0.22, 1);
  pulse = Math.max(0, pulse - sec * 3.2);
  halo.scale.setScalar(2.0 + pulse * 0.8); halo.material.color.set(theme.neon);
  hero.position.set(hx, hy, 0);
  const sup = supportAt(hx);
  shadowBlob.visible = alive && sup > -50; shadowBlob.position.set(hx, Math.max(0, sup) + 0.02, 0); shadowBlob.material.color.set(theme.neon);
  shadowBlob.scale.setScalar(clamp(1.3 - (hy - Math.max(0, sup)) * 0.25, 0.4, 1.3));
  // ribbon trail
  if (alive) { trailPts.unshift([hx, hy + 0.46]); if (trailPts.length > TR) trailPts.pop(); }
  else if (trailPts.length) trailPts.pop();
  const pa = trailGeo.attributes.position.array, ca = trailGeo.attributes.color.array;
  _c.set(theme.neon); _c2.set('#ff3ad9');
  for (let i = 0; i < TR; i++) {
    const p = trailPts[Math.min(i, trailPts.length - 1)] || [hx, hy + 0.46], f = 1 - i / TR, w = 0.2 * f + 0.02;
    pa.set([p[0], p[1] - 0.1, w * 1.1, p[0], p[1] - 0.1, -w * 1.1], i * 6);
    const cc = _c.clone().lerp(_c2, i / TR).multiplyScalar(f * (trailPts.length ? 0.9 : 0));
    ca.set([cc.r, cc.g, cc.b, cc.r, cc.g, cc.b], i * 6);
  }
  trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
  // spikes + beat lines instancing
  let n = 0; _c.set(theme.spike);
  for (const sp of spikeList) {
    if (n >= SPK) break; if (sp.x > hx + 90) break;
    const near = Math.max(0, 1 - Math.abs(sp.x - hx - 1) / 3) * pulse;
    _m.compose(_p.set(sp.x, sp.y, 0), _q.identity(), _s.set(1, 1 + near * 0.15, 1));
    spikes.setMatrixAt(n, _m); spikeWire.setMatrixAt(n, _m); spikeWire.setColorAt(n, _c2.set(THEMES[sp.sec % THEMES.length].spike)); n++;
  }
  spikes.count = spikeWire.count = n; spikes.instanceMatrix.needsUpdate = spikeWire.instanceMatrix.needsUpdate = true;
  if (spikeWire.instanceColor) spikeWire.instanceColor.needsUpdate = true;
  spikes.material.emissive.copy(_c.set(theme.spike)); spikes.material.emissiveIntensity = 0.3 + pulse * 0.3;
  let bn = 0;
  for (let i = Math.max(0, beatI - 12); i < beatList.length && bn < BL; i++) {
    const b = beatList[i]; if (b.x > hx + 90) break;
    const age = songT - b.t, glow = age >= 0 ? Math.exp(-age * 4) : 0;
    _m.compose(_p.set(b.x, b.y, 0), _q.identity(), _s.set(1 + glow * 2, 1, 1)); beatLines.setMatrixAt(bn, _m);
    beatLines.setColorAt(bn, _c.set(b.c).multiplyScalar(0.35 + glow * 0.9)); bn++;
  }
  beatLines.count = bn; beatLines.instanceMatrix.needsUpdate = true; if (beatLines.instanceColor) beatLines.instanceColor.needsUpdate = true;
  for (const p of padList) if (p.mesh) p.mesh.scale.lerp(_s.set(1, 1, 1), 0.15);
  sparks.update(dt); updShards(sec);
  // camera: 3/4 view from behind-left, runway recedes up-right
  camY = lerp(camY, Math.max(0, hy) * 0.55 + 1, 0.06 * dt);
  const shake = !alive && deadT < 0.3 ? (0.3 - deadT) * 0.6 : 0;
  camera.position.set(hx - 5.6 + (Math.random() - 0.5) * shake, camY + 2.9 + (Math.random() - 0.5) * shake, 1.9);
  camera.lookAt(hx + 6, camY - 0.2, -0.4);
  gridMat.uniforms.cam.value.copy(camera.position); gridMat.uniforms.pulse.value = pulse;
  sky.uniforms.pulse.value = pulse * 0.6;
  grid.position.x = Math.round(hx / 4) * 4; grid.position.z = 0;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
  sun.position.set(camera.position.x + dir.x * 200, 22, camera.position.z + dir.z * 200);
  sunGlow.position.copy(sun.position);
  stars.position.set(camera.position.x, 0, camera.position.z); sky.position.copy(stars.position);
  mtnD.forEach((m, i) => {
    const ang = Math.atan2(dir.z, dir.x) + (m.a - 0.5) * 1.6, r = 150;
    _m.compose(_p.set(camera.position.x + Math.cos(ang) * r, -5 + 8 * m.s * 0.5, camera.position.z + Math.sin(ang) * r), _q.identity(), _s.set(m.s * 1.4, m.s, m.s * 1.4)); mtns.setMatrixAt(i, _m);
  });
  mtns.instanceMatrix.needsUpdate = true;
});

reset(); ui.start(); ui.els.sc.classList.add('hc-hidden');

// ---------------------------------------------------------------- test hook + bot (taps on the planned beat of the next obstacle)
window.__game = {
  get state() { return state; }, get level() { return curSec + 1; }, get score() { return score; },
  bot() {
    if (state !== 'play' || !alive || botPending) return;
    const next = taps.find(tt => tt > lastBot + 0.05 && tt > songT - 0.03);
    if (next === undefined) return;
    const ms = (next - songT) * 1000;
    if (ms < 170) { botPending = true; lastBot = next; setTimeout(() => { botPending = false; jump(false); }, Math.max(0, ms - 12 + (Math.random() - 0.5) * 30)); }
  },
};

// Kickoff Crew — a 3D football match where the player's AI coding agents are the team.
// Agent work moves the ball (tool results = passes, failures = turnovers, tests/commits = shots, deploys = screamers);
// the player is the coach: tactics, pep talks, timing every finish and every save. Our own code, MIT.
import { THREE, createStage, mat, glossy, rounded, stickman, burst, confetti, tone, store, loop, lerp, clamp } from './kit/hc.js';
import { agents, toolName, toast } from './kit/agents.js';
import { board, flag } from './kit/board.js';

const V3 = THREE.Vector3, PI = Math.PI;
const $ = id => document.getElementById(id);
const phone = () => innerWidth / innerHeight < 0.8;
const L = 20, W = 12.5, GW = 3.3, GH = 2.3, GD = 1.8, MATCH = 300, WIN_AT = 3, MAXLEADS = 7, MAXSUBS = 4;
const xOf = p => -17 + p * 34;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const dayStr = () => new Date().toLocaleDateString('en-CA');
const esc = s => String(s).replace(/[<&>"]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- clubs, kits, trophies, tactics
const US = { name: 'Kickoff Crew', short: 'CREW', color: '#b8ff3c' };
const BOTS = [
  { name: 'Segfault City', short: 'SEG', color: '#e8505b', str: 0.58 },
  { name: 'Rustbolt Rovers', short: 'RUS', color: '#f08a24', str: 0.5 },
  { name: 'Kernel Athletic', short: 'KER', color: '#7c5cff', str: 0.62 },
  { name: 'Bitwise Wanderers', short: 'BIT', color: '#19b5a5', str: 0.46 },
  { name: 'Lintshire Town', short: 'LIN', color: '#5b6b8c', str: 0.4 },
];
const CLUB = s => s === US.short ? US : BOTS.find(b => b.short === s);
const KITS = [
  { id: 'classic', name: 'Classic White', shorts: '#f4f4f4', need: 0 },
  { id: 'night', name: 'Night Shift', shorts: '#1f2747', need: 6 },
  { id: 'sun', name: 'Sunburst', shorts: '#ffb627', need: 15 },
  { id: 'mint', name: 'Mint Condition', shorts: '#3ddc97', need: 25 },
  { id: 'lava', name: 'Lava Lamp', shorts: '#ff4d6d', need: 40 },
  { id: 'gold', name: 'Gilded', shorts: '#e8c547', need: -1 },
];
const TROPHIES = [
  ['first_goal', '⚽', 'Off the mark', 'Score your first goal'],
  ['first_win', '🥇', 'Three points', 'Win a match'],
  ['clean', '🧤', 'Clean sheet', 'Win without conceding'],
  ['hat', '🎩', 'Hat-trick hero', 'One agent scores 3 in a match'],
  ['screamer', '🚀', 'Screamer', 'Score a deploy power shot'],
  ['comeback', '🔁', 'Comeback', 'Win after going behind'],
  ['super_sub', '🔄', 'Super sub', 'A subagent scores'],
  ['safe', '🛡️', 'Safe hands', 'Make 5 saves'],
  ['ten', '🔟', 'Ten-goal crew', 'Score 10 goals'],
  ['unbeaten', '🔥', 'Unbeaten run', '3 matches without a loss'],
  ['champ', '🏆', 'Champions', 'Win a season'],
];
const TAC = {
  attack: { name: '4-3-3 Attack', push: 2, adv: 1.2, cw: 0.07, rival: 1.25, tackle: -0.05, win: 0.16, saveT: 1.25 },
  balanced: { name: '4-4-2 Balanced', push: 0, adv: 1, cw: 0, rival: 1, tackle: 0, win: 0.22, saveT: 1.5 },
  bus: { name: '5-4-1 Low block', push: -3.5, adv: 0.82, cw: -0.04, rival: 0.75, tackle: 0.12, win: 0.3, saveT: 1.8 },
};
const AGCOL = ['#ff5d8f', '#3a86ff', '#ffd23f', '#2ec4b6', '#ff8c42', '#9b5de5', '#00bbf9', '#f15bb5', '#8ac926', '#ff595e', '#06d6a0', '#ffca3a'];
const SKINS = ['#ffd7ba', '#f1c27d', '#c68642', '#8d5524', '#ffdbac', '#e0ac69'];

// ---------------------------------------------------------------- saved data (demo plays on a throwaway copy)
const freshLeague = (season = 1) => { const t = {}; for (const c of [US, ...BOTS]) t[c.short] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; return { season, md: 0, table: t }; };
const freshToday = () => ({ d: dayStr(), passes: 0, shots: 0, tests: 0, commits: 0, deploys: 0, fails: 0, tokens: 0, goals: 0, conceded: 0, matches: 0, wins: 0, labels: [] });
const DEF = () => ({ league: freshLeague(), career: { matches: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, saves: 0, passes: 0, unbeaten: 0, titles: 0 }, today: freshToday(), trophies: [], kits: ['classic'], kit: 'classic', tactic: 'balanced', match: null, last: null });
const DB = store('kickoffcrew');
let REAL; try { REAL = Object.assign(DEF(), DB.get('data', null) || {}); } catch (e) { REAL = DEF(); }
let DEMO = null, demoMode = false;
const D = () => (demoMode ? DEMO : REAL);
let saveT = 0;
function save(now) { if (demoMode && !now) return; clearTimeout(saveT); saveT = setTimeout(() => { try { DB.set('data', REAL); } catch (e) {} }, now ? 0 : 800); }
function rollToday() { if (REAL.today.d !== dayStr()) { REAL.today = freshToday(); save(); } }
rollToday();
const P = { mode: 'wait', poss: 'them', p: 0.5, holder: null, shotCd: 6, idle: 0, pep: 0, pepN: 2, meter: 0, tactic: REAL.tactic || 'balanced', crowd: 0.2, cHome: 0, cAway: 0, modeT: 0, shake: 0, ts: 1, rivalPassT: 0 };
let M = null;   // the match in play

// ---------------------------------------------------------------- stage
const S = createStage({ fov: 40, shadowSize: 27, clear: '#16204a' });
const { scene, camera, renderer, sun, hemi } = S;
sun.position.set(-10, 30, 16); sun.target.position.set(0, 0, 0); sun.intensity = 1.85; hemi.intensity = 1.05;
sun.shadow.camera.far = 90; sun.shadow.camera.updateProjectionMatrix();
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const ctex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
{
  const [c, g] = cv(4, 512), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#2b3f9e'); gr.addColorStop(0.45, '#7a6fd6'); gr.addColorStop(0.72, '#f59ab8'); gr.addColorStop(1, '#ffd49a');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512); scene.background = ctex(c);
}
scene.fog = new THREE.Fog('#c99ad8', 80, 170);

// pitch: mowing stripes + markings drawn in code
{
  const [c, g] = cv(2048, 1336), PX = 2048 / 46, X = x => (x + 23) * PX, Z = z => (z + 15) * PX;
  for (let i = 0; i < 23; i++) { g.fillStyle = i % 2 ? '#5fcf5c' : '#55c252'; g.fillRect(i * 2048 / 23, 0, 2048 / 23 + 1, 1336); }
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,60,0'},0.035)`; g.fillRect(Math.random() * 2048, Math.random() * 1336, 6, 6); }
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 0.15 * PX; g.fillStyle = '#fff';
  const ln = (a, b, c2, d) => { g.beginPath(); g.moveTo(X(a), Z(b)); g.lineTo(X(c2), Z(d)); g.stroke(); };
  const arc = (x, z, r, a0 = 0, a1 = 2 * PI) => { g.beginPath(); g.arc(X(x), Z(z), r * PX, a0, a1); g.stroke(); };
  const dot = (x, z) => { g.beginPath(); g.arc(X(x), Z(z), 0.18 * PX, 0, 2 * PI); g.fill(); };
  g.strokeRect(X(-L), Z(-W), 2 * L * PX, 2 * W * PX); ln(0, -W, 0, W); arc(0, 0, 3.4); dot(0, 0);
  for (const s of [-1, 1]) {
    g.strokeRect(Math.min(X(s * L), X(s * (L - 5.5))), Z(-7.5), 5.5 * PX, 15 * PX);
    g.strokeRect(Math.min(X(s * L), X(s * (L - 2))), Z(-4), 2 * PX, 8 * PX);
    dot(s * (L - 4), 0); const a = Math.acos(1.5 / 3.4);
    if (s > 0) arc(L - 4, 0, 3.4, PI - a, PI + a); else arc(-L + 4, 0, 3.4, -a, a);
    for (const t of [-1, 1]) arc(s * L, t * W, 0.8);
  }
  const tex = ctex(c); tex.anisotropy = 8;
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  pitch.rotation.x = -PI / 2; pitch.receiveShadow = true; scene.add(pitch);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), mat('#3d9446', { roughness: 1 }));
  apron.rotation.x = -PI / 2; apron.position.y = -0.02; apron.receiveShadow = true; scene.add(apron);
}

// ad boards (original slogans only)
const boardTex = (() => {
  const [c, g] = cv(2048, 64), msgs = [['KICKOFF CREW', '#b8ff3c', '#16204a'], ['PASS IT ON', '#16204a', '#ffd23f'], ['GREEN TESTS', '#ffffff', '#2ec4b6'], ['TOP BINS', '#ffffff', '#ff5d8f'], ['SHIP IT', '#16204a', '#ffffff'], ['GOOD BALL', '#ffffff', '#7c5cff']];
  g.font = '800 40px Bungee, Impact, sans-serif'; g.textBaseline = 'middle';
  const seg = 2048 / msgs.length;
  msgs.forEach(([t, fg, bg], i) => { g.fillStyle = bg; g.fillRect(i * seg, 0, seg, 64); g.fillStyle = fg; g.textAlign = 'center'; g.fillText(t, i * seg + seg / 2, 34); });
  const t = ctex(c); t.wrapS = THREE.RepeatWrapping; return t;
})();
{
  const add = (len, x, z, ry) => {
    const t = boardTex.clone(); t.needsUpdate = true; t.repeat.set(len / 26, 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.75, 0.15), new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.45, roughness: 0.6 }));
    m.position.set(x, 0.38, z); m.rotation.y = ry; m.castShadow = true; scene.add(m); boards.push(t);
  };
  var boards = [];
  add(44, 0, -W - 1.5, 0); add(44, 0, W + 1.5, PI); add(26, -L - 3, 0, PI / 2); add(26, L + 3, 0, -PI / 2);
}

// stands + instanced crowd
const crowd = (() => {
  const stMat = mat('#c3cdea'), stMat2 = mat('#aab6dd'), pos = [], tiers = 6, rise = 0.62, run = 1.05;
  for (const s of [-1, 1]) for (let i = 0; i < tiers; i++) {
    const h = rise * (i + 1), z = s * (W + 3.3 + i * run);
    const m = new THREE.Mesh(new THREE.BoxGeometry(52, h, run), i % 2 ? stMat : stMat2); m.position.set(0, h / 2, z); m.receiveShadow = true; scene.add(m);
    for (let x = -25; x <= 25; x += 0.64) pos.push([x + rnd(-0.12, 0.12), h, z, x < 0 ? 0 : 1]);
    const e = new THREE.Mesh(new THREE.BoxGeometry(run, h, 31), i % 2 ? stMat : stMat2); e.position.set(s * (L + 4.6 + i * run), h / 2, 0); e.receiveShadow = true; scene.add(e);
    for (let zz = -14.5; zz <= 14.5; zz += 0.64) pos.push([s * (L + 4.6 + i * run) + rnd(-0.1, 0.1), h, zz, s < 0 ? 0 : 1]);
  }
  const roofM = mat('#e9eefc');
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(54, 0.3, 4), roofM); r.position.set(0, 6.6, s * (W + 7.5)); r.rotation.x = s * 0.18; r.castShadow = true; scene.add(r); }
  const im = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.26, 3, 6), mat('#ffffff'), pos.length);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im);
  const ph = pos.map(() => Math.random() * 9), sp = pos.map(() => rnd(6, 11)), side = pos.map(p => p[3]);
  const col = new THREE.Color(), dm = new THREE.Object3D();
  function paint(home, away) {
    pos.forEach((p, i) => {
      const r = Math.random(), mine = side[i] === 0 ? r < 0.7 : r < 0.25;
      col.set(mine ? (Math.random() < 0.5 ? home : '#ffffff') : r < 0.85 ? away : pick(AGCOL)); col.offsetHSL(0, 0, rnd(-0.08, 0.08)); im.setColorAt(i, col);
      side[i] = side[i] === 0 || side[i] === 2 ? (mine ? 0 : 2) : (mine ? 3 : 1);   // 0/3 = home fans, 1/2 = away fans
    });
    im.instanceColor.needsUpdate = true;
  }
  function update(t) {
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i], home = side[i] === 0 || side[i] === 3, ex = home ? P.cHome : P.cAway;
      const j = Math.max(0, Math.sin(t * sp[i] + ph[i])) * (0.03 + P.crowd * 0.12 + ex * 0.45);
      dm.position.set(p[0], p[1] + 0.3 + j, p[2]); dm.rotation.z = Math.sin(t * 3 + ph[i]) * 0.08 * (P.crowd + ex); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  }
  return { paint, update, pos };
})();

// floodlights + camera flashes
const glowTex = (() => { const [c, g] = cv(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,250,220,.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return ctex(c); })();
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 17, 10), mat('#dfe5f5')); pole.position.set(sx * 27, 8.5, sz * 20); pole.castShadow = true; scene.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 0.4), new THREE.MeshStandardMaterial({ color: '#fffbe0', emissive: '#fff6c8', emissiveIntensity: 1 }));
  head.position.set(sx * 27, 17.4, sz * 20); head.lookAt(0, 0, 0); scene.add(head);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); gl.scale.set(10, 10, 1); gl.position.copy(head.position); scene.add(gl);
}
const flashes = Array.from({ length: 24 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); s.scale.set(0.9, 0.9, 1); scene.add(s); return s; });
// corner flags
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), mat('#ffffff')); p.position.set(sx * L, 0.7, sz * W); scene.add(p);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), mat(US.color, { side: THREE.DoubleSide })); f.position.set(sx * L + 0.25, 1.22, sz * W); scene.add(f);
}

// goals with rippling nets
function makeNet(w, h, nu, nv) {
  const pts = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pts.push(-w / 2 + (w * i) / nu, -h / 2 + (h * j) / nv, 0);
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const k = j * (nu + 1) + i; if (i < nu) idx.push(k, k + 1); if (j < nv) idx.push(k, k + nu + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setIndex(idx);
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
}
const goals = [-1, 1].map(s => {
  const g = new THREE.Group(), white = glossy('#ffffff');
  const post = len => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 12), white); m.castShadow = true; return m; };
  const p1 = post(GH); p1.position.set(0, GH / 2, -GW); const p2 = post(GH); p2.position.set(0, GH / 2, GW);
  const bar = post(GW * 2 + 0.2); bar.rotation.x = PI / 2; bar.position.set(0, GH, 0);
  const back = makeNet(GW * 2, GH, 28, 10); back.rotation.y = s * PI / 2; back.position.set(s * GD, GH / 2, 0);
  const top = makeNet(GW * 2, GD, 28, 6); top.rotation.set(-PI / 2, 0, s > 0 ? PI / 2 : -PI / 2); top.position.set(s * GD / 2, GH, 0);
  const sides = [-1, 1].map(t => { const n = makeNet(GD, GH, 6, 10); n.position.set(s * GD / 2, GH / 2, t * GW); return n; });
  g.add(p1, p2, bar, back, top, ...sides); g.position.x = s * L; scene.add(g);
  return { s, back, base: back.geometry.attributes.position.array.slice(), t: 9, lx: 0, ly: 0 };
});
function ripple(side, z, y) { const g = goals[side > 0 ? 1 : 0]; g.t = 0; g.lx = -g.s * z; g.ly = y - GH / 2; }
function updateNets(dt) {
  for (const g of goals) {
    if (g.t > 4) continue; g.t += dt;
    const a = g.back.geometry.attributes.position, arr = a.array, k = Math.exp(-g.t * 1.6);
    for (let i = 0; i < arr.length; i += 3) {
      const dx = g.base[i] - g.lx, dy = g.base[i + 1] - g.ly, d = Math.hypot(dx, dy);
      arr[i + 2] = k * (0.9 * Math.exp(-d * d * 0.8) * Math.exp(-g.t * 2) + 0.18 * Math.sin(d * 3.2 - g.t * 13) * Math.exp(-d * 0.35));
    }
    a.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- people
const shortsMat = mat(KITS[0].shorts), bootMat = mat('#1d2033'), rivalShirt = mat(BOTS[0].color), rivalShorts = mat('#2a2f45');
function makeMan(shirt, { robot = false, shorts = shortsMat } = {}) {
  const m = stickman(shirt, robot ? '#cfd6e4' : pick(SKINS), 1);
  if (robot) m.body.material = m.armL.children[0].material = m.armR.children[0].material = rivalShirt;
  for (const leg of [m.legL, m.legR]) {
    leg.children[0].material = shorts;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bootMat); b.scale.set(1, 0.7, 1.5); b.position.set(0, -0.55, 0.05); b.castShadow = true; leg.add(b);
  }
  if (robot) {
    m.head.geometry = rounded(0.42, 0.36, 0.38, 0.1); m.head.material = glossy('#dde3ee');
    const vis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.04), new THREE.MeshStandardMaterial({ color: '#60f0ff', emissive: '#60f0ff', emissiveIntensity: 0.9 })); vis.position.set(0, 0.03, 0.2); m.head.add(vis);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 5), mat('#99a3b8')); ant.position.y = 0.27; m.head.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#ff4d6d', emissive: '#ff4d6d', emissiveIntensity: 0.8 })); tip.position.y = 0.38; m.head.add(tip);
  } else {
    for (const x of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#1d2033')); e.position.set(x, 0.03, 0.18); m.head.add(e); }
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 8, 0, 2 * PI, 0, PI / 2.2), mat(pick(['#2b1d14', '#5a3a22', '#e8c27a', '#1a1a1a', '#a0522d', '#d9d9d9']))); hair.rotation.x = -0.25; m.head.add(hair);
  }
  m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(m); return m;
}
function spriteCanvas(text, bg, fg = '#fff', w = 320) {
  const [c, g] = cv(w, 84); g.font = '800 42px "Baloo 2", system-ui, sans-serif';
  const tw = Math.min(w - 8, g.measureText(text).width + 36), x = (w - tw) / 2;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(x, 12, tw, 66, 22); g.fill();
  g.fillStyle = bg; g.beginPath(); g.roundRect(x, 6, tw, 66, 22); g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.45)';
  if (fg === '#fff') g.strokeText(text, w / 2, 41, w - 40); g.fillText(text, w / 2, 41, w - 40);
  return c;
}
function makeSprite(c, sx = 1.95) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex(c), depthTest: false, transparent: true })); s.scale.set(sx, sx * 84 / 320, 1); s.renderOrder = 10; return s; }
function setSprite(s, c) { s.material.map.dispose(); s.material.map = ctex(c); s.material.needsUpdate = true; }
const lightText = col => { const c = new THREE.Color(col); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.62; };

const actors = [];
function makeActor(team, shirt, opts = {}) {
  const mesh = makeMan(shirt, opts);
  const a = { team, mesh, pos: new V3(rnd(-3, 3), 0, W + 1.5), tgt: new V3(), face: 0, phase: Math.random() * 9, run: 0, speed: opts.speed || 6.2, seed: Math.random() * 9, hz: 0, lock: 0, raise: false, cele: 0, dive: null, color: shirt, label: '', rec: null, bubT: 0 };
  a.mesh.position.copy(a.pos);
  actors.push(a); return a;
}
function tagActor(a, label, color) {
  a.label = label; a.color = color;
  a.mesh.body.material.color.set(color);
  if (a.tag) setSprite(a.tag, spriteCanvas(label, color, lightText(color) ? '#16204a' : '#fff'));
  else { a.tag = makeSprite(spriteCanvas(label, color, lightText(color) ? '#16204a' : '#fff')); a.tag.position.y = 2.2; a.mesh.add(a.tag); }
}
function bubble(a, text, bg = '#ffffff', fg = '#16204a', ms = 1100) {
  if (!a || !a.mesh) return;
  if (!a.bub) { a.bub = makeSprite(spriteCanvas(text, bg, fg), 1.5); a.bub.position.y = 2.75; a.mesh.add(a.bub); }
  else setSprite(a.bub, spriteCanvas(text, bg, fg));
  a.bub.visible = true; a.bubT = ms / 1000;
}
function removeActor(a) { const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); scene.remove(a.mesh); if (P.holder === a) P.holder = null; if (ball.owner === a) ball.owner = null; }

const ourKeeper = makeActor('us', '#2b2f45', { speed: 7 });
ourKeeper.mesh.body.material = mat('#ffd23f'); ourKeeper.mesh.armL.children[0].material = ourKeeper.mesh.armR.children[0].material = mat('#ffd23f'); ourKeeper.keeper = true;
const rivals = Array.from({ length: 5 }, (_, i) => { const r = makeActor('them', BOTS[0].color, { robot: true, shorts: rivalShorts, speed: 5.6 }); r.lane = [-7, -2.4, 2.4, 7, 0][i]; r.pos.set(6 + i, 0, r.lane); return r; });
const rivalKeeper = makeActor('them', '#20c997', { robot: true, shorts: rivalShorts, speed: 7 });
rivalKeeper.mesh.body.material = mat('#9be15d'); rivalKeeper.mesh.armL.children[0].material = rivalKeeper.mesh.armR.children[0].material = rivalKeeper.mesh.body.material; rivalKeeper.keeper = true;
ourKeeper.pos.set(-L + 0.8, 0, 0); rivalKeeper.pos.set(L - 0.8, 0, 0);

// ball
const ball = (() => {
  const [c, g] = cv(256, 128); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#1d2033';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { g.beginPath(); const x = i * 32 + (j % 2) * 16 + 8, y = j * 32 + 16; for (let k = 0; k < 5; k++) { const an = (k / 5) * 2 * PI; g.lineTo(x + Math.cos(an) * 9, y + Math.sin(an) * 9); } g.fill(); }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 16), new THREE.MeshStandardMaterial({ map: ctex(c), roughness: 0.4 }));
  mesh.castShadow = true; scene.add(mesh);
  return { mesh, pos: new V3(0, 0.21, 0), owner: null, fl: null };
})();
function kick(to, dur, h = 0.3, onLand = null) { ball.fl = { from: ball.pos.clone(), to: to.clone(), t: 0, dur, h, onLand }; ball.owner = null; tone(300 + Math.random() * 80, 0.06, 'sine', 0.1, 0.6); }

// ---------------------------------------------------------------- agents → players
const AG = new Map();
let colorIdx = 0;
const field = () => actors.filter(a => a.rec);
function freeColor() { const used = new Set([...AG.values()].map(r => r.color)); for (let i = 0; i < AGCOL.length; i++) { const c = AGCOL[(colorIdx + i) % AGCOL.length]; if (!used.has(c)) { colorIdx = (colorIdx + i + 1) % AGCOL.length; return c; } } return AGCOL[colorIdx++ % AGCOL.length]; }
function agentRec(e) {
  let r = AG.get(e.agent);
  if (!r) {
    const sub = !!e.parent;
    r = { id: e.agent, parent: e.parent, sub, src: e.src, label: String(e.label || 'agent').slice(0, 14), color: freeColor(), actor: null, last: Date.now(), passes: 0, goals: 0, waiting: false, seen: 0 };
    const base = sub ? '↳ ' + r.label : r.label, taken = new Set([...AG.values()].map(x => x.tag));
    let n = 1; r.tag = base; while (taken.has(r.tag)) r.tag = `${base}·${++n}`;
    AG.set(e.agent, r);
  }
  return r;
}
function onField(r) {
  if (r.actor) return r.actor;
  const f = field(), mine = f.filter(a => a.rec.sub === r.sub);
  if (mine.length >= (r.sub ? MAXSUBS : MAXLEADS)) {
    // the bench: swap with the least busy player of the same kind
    const out = mine.sort((a, b) => a.rec.last - b.rec.last)[0]; if (!out || Date.now() - out.rec.last < 4000) return null;
    const old = out.rec; old.actor = null; out.rec = r; r.actor = out; tagActor(out, r.tag, r.color);
    say(`🔄 Change: ${r.tag} on, ${old.tag} off`, r.color); return out;
  }
  const a = makeActor('us', r.color); a.rec = r; r.actor = a; a.sub = r.sub;
  a.pos.set(rnd(-2, 2), 0, W + 1.2); a.mesh.position.copy(a.pos); tagActor(a, r.tag, r.color);
  if (P.mode === 'wait' || !M) { /* first players walk out of the tunnel */ }
  say(r.sub ? `${r.tag} comes on as a winger` : `${r.tag} walks out for ${US.short}`, r.color);
  return a;
}
function dropAgent(r, why) {
  if (r.actor) { const a = r.actor; a.rec = null; r.actor = null; a.leaving = 3; a.tgt.set(a.pos.x, 0, W + 3); if (a.tag) a.tag.visible = false; if (P.holder === a) loseBall(); }
  AG.delete(r.id); if (why) say(why, r.color);
}

// ---------------------------------------------------------------- commentary, pops, banner, sounds
function say(text, color = '#b8ff3c') {
  const el = $('feed'), d = document.createElement('div'); d.style.setProperty('--c', color);
  d.innerHTML = `<em>${M ? minute() : 0}'</em>${esc(text)}`; el.appendChild(d); while (el.children.length > 4) el.firstChild.remove();
}
function wpop(text, pos, color = '#fff', size = 18) {
  const v = pos.clone(); v.y += 2.4; v.project(camera); if (v.z > 1) return;
  const d = document.createElement('div'); d.textContent = text; d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; d.style.color = color; d.style.fontSize = size + 'px';
  $('pops').appendChild(d); setTimeout(() => d.remove(), 1150);
}
function banner(h, p = '', color = '#fff') { const b = $('banner'); b.querySelector('h1').textContent = h; b.querySelector('h1').style.color = color; b.querySelector('p').textContent = p; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
const whistle = (n = 1) => { for (let i = 0; i < n; i++) setTimeout(() => { tone(2300, 0.16, 'sine', 0.05, 0.98); tone(2450, 0.16, 'triangle', 0.03, 1); }, i * 260); };
const roar = (v = 0.06) => { for (let i = 0; i < 6; i++) setTimeout(() => tone(rnd(90, 180), 0.35, 'sawtooth', v, rnd(0.8, 1.3)), i * 70); };
function flashScreen(a = 0.6) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = 0; }); }
const minute = () => Math.min(90, Math.floor((M ? M.clock : 0) / MATCH * 90));

// ---------------------------------------------------------------- match flow
function newMatch(data) {
  const lg = data.league, opp = BOTS[lg.md % BOTS.length];
  return { md: lg.md, season: lg.season, opp: opp.short, us: 0, them: 0, clock: 0, scorers: [], shots: 0, passes: 0, saves: 0, trailed: false, ended: false, demo: demoMode, agentGoals: {}, agentPasses: {} };
}
const opp = () => CLUB(M ? M.opp : BOTS[D().league.md % BOTS.length].short);
function dressRivals() {
  const o = opp(); rivalShirt.color.set(o.color);
  crowd.paint(US.color, o.color);
  $('themName').textContent = o.short; $('themBadge').style.background = o.color; $('usBadge').style.background = US.color;
  document.documentElement.style.setProperty('--them', o.color);
  const lg = D().league; $('fixture').innerHTML = `<span class="ss">Season ${lg.season} · </span>Matchday ${Math.min(lg.md + 1, 10)}/10 · vs ${o.name}`;
}
function ensureMatch(demo) {
  if (M && M.demo === demo && !M.ended) return;
  if (M && M.demo !== demo) { for (const r of [...AG.values()]) dropAgent(r); }
  demoMode = demo;
  if (demo) { DEMO = JSON.parse(JSON.stringify(REAL)); DEMO.match = null; }
  const d = D();
  if (!demo && d.match && !d.match.ended && d.match.season === d.league.season && d.match.md === d.league.md) M = d.match;
  else { M = newMatch(d); d.match = M; save(); }
  P.pepN = 2; P.meter = 0; P.pep = 0; hideFT();
  dressRivals(); updateScore(); kickoff(M.clock > 0 ? 'us' : 'us', true);
}
function kickoff(team, fresh) {
  P.p = 0.5; P.mode = 'play'; P.shotCd = 5; P.idle = 0; P.ts = 1;
  ball.fl = null; ball.pos.set(0, 0.21, 0);
  const leads = field().filter(a => !a.sub);
  if (team === 'us' && leads.length) { give(leads[(Math.random() * leads.length) | 0]); }
  else { give(rivals[4]); }
  formation(0, true);
  for (const a of actors) if (!a.leaving && !a.keeper) a.pos.copy(a.tgt);
  ball.pos.set(0, 0.21, 0); if (P.holder) P.holder.pos.set(-0.5 * (P.poss === 'us' ? 1 : -1), 0, 0);
  whistle(1);
  if (fresh && M.clock === 0) { banner('KICK OFF', `${US.short} vs ${opp().name}`); say(`Kick off! ${US.name} vs ${opp().name}. ${TAC[P.tactic].name}.`); }
}
function give(a) { P.holder = a; ball.owner = a; ball.fl = null; P.poss = a.team; a.hz = a.pos.z; P.idle = 0; }
function loseBall() { give(nearest(rivals, ball.pos)); }
const nearest = (list, p) => list.reduce((b, a) => (!b || a.pos.distanceToSquared(p) < b.pos.distanceToSquared(p) ? a : b), null);

// formation targets for everyone, every frame
function formation(t, snap) {
  const bx = ball.pos.x, ours = P.poss === 'us', tac = TAC[P.tactic];
  const f = field(), leads = f.filter(a => !a.sub), subs = f.filter(a => a.sub);
  const rows = [[], [], []]; leads.forEach((a, i) => rows[[1, 0, 2][i % 3]].push(a));
  rows.forEach((row, r) => row.forEach((a, k) => {
    if (a === P.holder || a.lock > 0 || a.cele > 0) return;
    const lane = row.length === 1 ? (r === 1 ? 0 : r === 0 ? 3 : -3) : -8.5 + (17 * k) / (row.length - 1);
    const dx = [5.5, 0.5, -6][r] + (ours ? 2 : -3.5) + tac.push;
    a.tgt.set(clamp(bx + dx + Math.sin(t * 0.7 + a.seed) * 1.3, -17, 17.5), 0, lane + Math.cos(t * 0.5 + a.seed) * 0.9);
  }));
  subs.forEach((a, i) => { if (a === P.holder || a.lock > 0 || a.cele > 0) return; a.tgt.set(clamp(bx + 3 + (ours ? 2 : -3) + Math.sin(t + a.seed), -16, 17.5), 0, (i % 2 ? -1 : 1) * (10.2 - (i >> 1) * 1.2)); });
  // our presser when the rivals have it
  if (!ours && P.holder && leads.length) { const pr = nearest(leads.filter(a => a.cele <= 0 && a.lock <= 0), P.holder.pos); if (pr) pr.tgt.set(P.holder.pos.x - 1, 0, P.holder.pos.z + 0.4); }
  if (P.holder && P.holder.team === 'us' && P.holder.lock <= 0) P.holder.tgt.set(xOf(P.p), 0, P.holder.hz * 0.5);
  if (P.holder && P.holder.team === 'them' && !P.holder.keeper) P.holder.tgt.set(xOf(P.p), 0, P.holder.hz * 0.6);
  // rivals
  const presser = ours && P.holder ? nearest(rivals, P.holder.pos) : null;
  rivals.forEach((b, i) => {
    if (b === P.holder || b.lock > 0 || b.cele > 0) return;
    if (b === presser) { b.tgt.set(P.holder.pos.x + 1.1, 0, P.holder.pos.z + 0.3); return; }
    const dx = ours ? [2.5, 2.8, 2.8, 2.5, -3][i] : [0.5, -1.5, -1.5, 0.5, -6][i];
    b.tgt.set(clamp(bx + dx + Math.sin(t * 0.6 + b.seed), -17.5, 17.5), 0, b.lane + Math.cos(t * 0.4 + b.seed));
  });
  if (!ourKeeper.dive && P.holder !== ourKeeper) ourKeeper.tgt.set(-L + 0.8, 0, clamp(ball.pos.z * 0.35, -2.5, 2.5));
  if (!rivalKeeper.dive && P.holder !== rivalKeeper) rivalKeeper.tgt.set(L - 0.8, 0, clamp(ball.pos.z * 0.35, -2.5, 2.5));
  if (snap) for (const a of [ourKeeper, rivalKeeper]) a.pos.copy(a.tgt);
}

// actions from agent work, played one by one so a burst reads as a passing move
const Q = [];
let qT = 0;
function queue(act) {
  Q.push(act);
  while (Q.length > 10) { const i = Q.findIndex(a => a.cat !== 'test' && a.cat !== 'commit' && a.cat !== 'deploy'); Q.splice(i < 0 ? 0 : i, 1); }
}
const KIND = { edit: ['through', 0.09, 'through ball'], read: ['short', 0.045, 'short pass'], run: ['dribble', 0.06, 'dribbles'], web: ['long', 0.14, 'long ball'], delegate: ['short', 0.04, 'lays it off'], other: ['short', 0.035, 'keeps it moving'], test: ['surge', 0.16, 'surges forward'], commit: ['surge', 0.16, 'breaks the line'], deploy: ['long', 0.2, 'launches it'] };
function doAction(act) {
  const r = AG.get(act.agent); if (!r) return;
  const pl = onField(r); if (!pl) return;
  r.last = Date.now();
  if (P.poss === 'them') {
    if (!act.ok) { P.p = Math.max(0.12, P.p - 0.07); say(`${opp().short} break forward (${r.tag}: step failed)`, opp().color); return; }
    const chance = 0.34 + TAC[P.tactic].tackle + (P.pep > 0 ? 0.15 : 0) - (opp().str - 0.5) * 0.3 + (act.cat === 'test' || act.cat === 'commit' || act.cat === 'deploy' ? 0.4 : 0);
    if (Math.random() < chance && P.holder && !P.holder.keeper) {
      const from = P.holder; kick(new V3(pl.pos.x, 0.21, pl.pos.z), 0.4, 0.3, () => give(pl)); P.poss = 'us'; P.holder = null;
      wpop('WON IT!', pl.pos, r.color, 20); say(`${r.tag} wins it back`, r.color); burst(scene, from.pos.clone().setY(0.4), [r.color, '#ffffff'], 10, { speed: 0.08, up: 0.06 }); tone(640, 0.08, 'triangle', 0.1, 1.3);
    } else if (Math.random() < 0.5) { wpop('press!', pl.pos, '#ffffff', 14); }
    return;
  }
  if (!P.holder) return;
  if (!act.ok) { // turnover
    const h = P.holder, t = nearest(rivals, h.pos);
    t.pos.lerp(h.pos, 0.6); give(t); P.p = Math.max(0.15, P.p - 0.03);
    wpop('TACKLED', h.pos, '#ff6b6b', 20); burst(scene, h.pos.clone().setY(0.4), ['#ffffff', opp().color], 12, { speed: 0.1, up: 0.08 });
    say(`Tackle! ${opp().short} take it off ${h.label || 'us'} (${r.tag}'s step failed)`, opp().color); tone(170, 0.18, 'square', 0.07, 0.6);
    if (!demoMode) {} return;
  }
  const shot = act.cat === 'test' || act.cat === 'commit', power = act.cat === 'deploy';
  if ((shot && P.p >= 0.5 || power && P.p >= 0.35) && P.shotCd <= 0) return shotChance(pl, power, act.cat);
  const [kind, dp0, words] = KIND[act.cat] || KIND.other;
  advance(pl, dp0, kind, words, r);
}
function advance(pl, dp, kind, words, r) {
  dp *= TAC[P.tactic].adv * (P.pep > 0 ? 1.4 : 1);
  const np = Math.min(0.86, P.p + dp), from = P.holder;
  M.passes++; r.passes++; M.agentPasses[r.tag] = (M.agentPasses[r.tag] || 0) + 1; P.idle = 0;
  if (pl === from) { P.p = np; wpop(kind === 'dribble' ? 'DRIBBLE' : 'DRIVES ON', pl.pos, r.color, 15); say(`${r.tag} ${kind === 'dribble' ? 'dribbles past one' : 'drives forward'}`, r.color); return; }
  const dest = new V3(xOf(np), 0, clamp(pl.pos.z * 0.6 + rnd(-2, 2), -9.5, 9.5));
  const dur = { short: 0.45, through: 0.6, long: 1.0, surge: 0.75, dribble: 0.5 }[kind], h = { short: 0.15, through: 0.5, long: 3.4, surge: 1.4, dribble: 0.1 }[kind];
  pl.tgt.copy(dest); pl.lock = dur + 0.3; pl.hz = dest.z;
  P.p = np; P.holder = null;
  kick(dest.clone().setY(0.21), dur, h, () => give(pl));
  wpop(kind === 'through' ? 'THROUGH BALL' : kind === 'long' ? 'LONG BALL' : kind === 'surge' ? 'SURGE!' : 'PASS', ball.pos, r.color, kind === 'short' ? 14 : 18);
  say(`${from && from.label ? from.label + ' → ' : ''}${r.tag}: ${words}`, r.color);
}

// ---------------------------------------------------------------- the coach's finish: shot aim and keeper save
const aim = { on: false, t: 0, dur: 4, u: 0, speed: 2.6, cw: 0.3, save: null, shooter: null, power: false };
function shotChance(pl, power, cat) {
  P.mode = 'aim'; P.shotCd = 15; aim.shooter = pl; aim.power = power; aim.cat = cat;
  if (P.holder !== pl) { kick(new V3(pl.pos.x, 0.21, pl.pos.z), 0.35, 0.2, () => { give(pl); }); }
  aim.on = true; aim.t = 0; aim.dur = 4; aim.save = null; aim.u = 0;
  aim.speed = (power ? 2.0 : 2.7) * (P.pep > 0 ? 0.75 : 1) * (0.9 + opp().str * 0.3);
  aim.cw = clamp(0.3 + TAC[P.tactic].cw + (power ? 0.12 : 0) + (P.pep > 0 ? 0.06 : 0), 0.15, 0.55);
  const el = $('aim'); el.hidden = false; el.classList.remove('save');
  $('aimTitle').textContent = power ? 'SCREAMER!' : 'SHOT CHANCE'; $('aimWho').textContent = pl.label + (power ? ' · deploy' : cat === 'test' ? ' · tests passed' : ' · commit');
  $('aimHint').textContent = phone() ? 'Tap when the marker hits a green corner' : 'Tap (or Space) when the marker hits a green corner';
  el.querySelector('.zl').style.width = el.querySelector('.zr').style.width = (aim.cw * 50) + '%';
  $('ret').hidden = false; $('tgt').hidden = true;
  pl.glow = 1; banner(power ? 'SCREAMER' : 'CHANCE!', `${pl.label} is through on goal`, '#ffd23f'); tone(880, 0.1, 'triangle', 0.1, 1.5);
  P.crowd = 1;
}
function startSave() {
  const shooter = P.holder; if (!shooter) return;
  P.mode = 'aim'; aim.on = true; aim.t = 0; aim.save = { u: rnd(0.2, 0.92) * (Math.random() < 0.5 ? -1 : 1), v: rnd(0.15, 0.85) }; aim.shooter = shooter;
  aim.dur = TAC[P.tactic].saveT * (1.1 - opp().str * 0.3);
  const el = $('aim'); el.hidden = false; el.classList.add('save');
  $('aimTitle').textContent = 'SAVE IT!'; $('aimWho').textContent = `${opp().short} shoot`;
  $('aimHint').textContent = 'Tap when the ring turns green';
  $('ret').hidden = true; const tg = $('tgt'); tg.hidden = false;
  tg.style.left = (50 + aim.save.u / 1.25 * 50) + '%'; tg.style.top = (10 + (1 - aim.save.v) * 110) * (phone() ? 0.81 : 1) + 'px';
  banner('SHOT!', `${opp().name} are through`, opp().color); tone(300, 0.2, 'square', 0.06, 0.7);
}
function aimUpdate(rdt) {
  if (!aim.on) return;
  aim.t += rdt;
  const left = 1 - aim.t / aim.dur; $('aimBar').style.width = Math.max(0, left) * 100 + '%';
  if (aim.save) {
    const r = 1 - aim.t / aim.dur, ring = $('tgt').querySelector('.ring');
    ring.style.transform = `scale(${Math.max(0.15, 1 + r * 3)})`; ring.classList.toggle('ok', r <= TAC[P.tactic].win + (P.pep > 0 ? 0.08 : 0) && r >= -0.02);
    if (aim.t > aim.dur + 0.18) resolveSave(false);
  } else {
    aim.u = Math.sin(aim.t * aim.speed + 0.6) * 1.22;
    $('ret').style.left = (50 + aim.u / 1.25 * 50) + '%';
    if (aim.t >= aim.dur) resolveShot();
  }
}
function coachTap() { if (!aim.on) return; if (aim.save) resolveSave(true); else resolveShot(); }
function closeAim() { aim.on = false; $('aim').hidden = true; P.ts = 1; }
function resolveShot() {
  const u = aim.u, pl = aim.shooter, r = pl.rec; closeAim(); M.shots++;
  const au = Math.abs(u), side = Math.sign(u) || 1, kd = Math.random() < 0.5 ? -1 : 1;
  let res;
  if (au > 1.0) res = au < 1.1 ? 'post' : 'wide';
  else if (au > 1 - aim.cw) res = side === kd && Math.random() < 0.22 + opp().str * 0.12 ? 'save' : 'goal';
  else res = aim.power && Math.random() < 0.38 ? 'goal' : 'save';
  if (!ball.owner || ball.owner !== pl) { give(pl); ball.pos.set(pl.pos.x + 0.4, 0.21, pl.pos.z); }
  const y = res === 'wide' ? rnd(0.4, 1.4) : res === 'post' ? 1.1 : au > 0.6 ? rnd(1.2, 2.0) : rnd(0.4, 1.6);
  const z = res === 'wide' ? side * (GW + rnd(0.6, 1.6)) : res === 'post' ? side * GW : u * GW;
  rivalKeeper.dive = { side: res === 'save' ? (z > rivalKeeper.pos.z ? 1 : -1) : kd, t: 0, z: res === 'save' ? z : kd * GW * 0.75 };
  P.mode = 'shot'; const dur = aim.power ? 0.55 : 0.75;
  if (aim.power) { P.shake = 0.5; flashScreen(0.35); }
  pl.glow = 0;
  kick(new V3(res === 'goal' ? L + 1.0 : res === 'save' ? L - 0.4 : L + 0.6, y, z), dur, aim.power ? 0.2 : 0.6, () => {
    if (res === 'goal') return goalScored('us', pl, aim.power);
    P.mode = 'play'; P.crowd = 0.5;
    if (res === 'save') { wpop('SAVED', rivalKeeper.pos, '#ffffff', 22); say(`Saved! ${opp().short}'s keeper denies ${pl.label}`, opp().color); kick(new V3(L - 3, 0.21, side * 6), 0.6, 1.2, () => give(nearest(rivals, ball.pos))); P.poss = 'them'; P.p = 0.78; }
    else { if (res === 'post') { wpop('OFF THE POST!', ball.pos, '#ffd23f', 22); tone(1500, 0.25, 'triangle', 0.1, 0.9); P.shake = 0.25; } else wpop('WIDE', ball.pos, '#ffffff', 20); say(res === 'post' ? `${pl.label} hits the post!` : `${pl.label} drags it wide`, r ? r.color : '#fff'); setTimeout(() => { if (P.mode === 'play') { ball.pos.set(L - 1.5, 0.21, 0); give(rivalKeeper); } }, 500); P.poss = 'them'; P.p = 0.85; }
    roar(0.04);
  });
  P.ts = res === 'goal' ? 0.45 : 0.8;
}
function resolveSave(tapped) {
  const r = 1 - aim.t / aim.dur, win = TAC[P.tactic].win + (P.pep > 0 ? 0.08 : 0), sv = aim.save, shooter = aim.shooter;
  const saved = tapped ? r <= win && r >= -0.03 : Math.random() < 0.2;
  const early = tapped && r > win;
  closeAim();
  const z = sv.u * GW, y = 0.3 + sv.v * 1.8;
  ourKeeper.dive = { side: Math.sign(z - ourKeeper.pos.z) || 1, t: early ? -0.2 : 0, z: saved ? z : -z * 0.5 };
  P.mode = 'shot';
  if (!ball.owner) { give(shooter); }
  kick(new V3(saved ? -L + 0.5 : -L - 1.0, y, z), 0.7, 0.4, () => {
    if (!saved) return goalScored('them', shooter);
    P.mode = 'play'; M.saves++; D().career.saves++; save();
    wpop('WHAT A SAVE!', ourKeeper.pos, '#ffd23f', 24); banner('SAVED!', 'Your keeper reads it', '#ffd23f'); P.cHome = 1; P.shake = 0.3; roar(0.05);
    say(`Save! The keeper keeps ${opp().short} out`, '#ffd23f');
    const leads = field().filter(a => !a.sub); P.p = 0.22;
    if (leads.length) { const to = nearest(leads, new V3(-12, 0, 0)); kick(new V3(xOf(0.22), 0.21, to.pos.z * 0.5), 0.8, 1.6, () => give(to)); to.tgt.set(xOf(0.22), 0, to.pos.z * 0.5); to.lock = 1; P.poss = 'us'; }
    else give(ourKeeper);
    award('safe', D().career.saves >= 5);
  });
  if (early) say('Dived too early!', '#ff6b6b');
}

// ---------------------------------------------------------------- goals, celebration, replay
const frames = []; let snapAfter = -1, snapshot = null, rp = null;
function record() {
  frames.push({ b: ball.pos.toArray(), a: actors.map(a => [a, a.pos.x, a.mesh.position.y, a.pos.z, a.mesh.rotation.y, a.phase, a.run, a.mesh.rotation.z]) });
  if (frames.length > 260) frames.shift();
  if (snapAfter > 0 && --snapAfter === 0) { snapshot = frames.slice(-140); snapAfter = -1; }
}
function goalScored(team, scorer, power = false) {
  const us = team === 'us', o = opp(), d = D();
  P.mode = 'goal'; P.modeT = 3.0; P.ts = 1; snapAfter = 40; snapshot = null;
  if (us) M.us++; else M.them++;
  if (M.us < M.them) M.trailed = true;
  const r = scorer && scorer.rec;
  M.scorers.push({ label: us ? (scorer.label || 'crew') : o.short, min: minute(), us, power, sub: !!(r && r.sub), color: us ? scorer.color : o.color });
  ripple(us ? 1 : -1, ball.pos.z, ball.pos.y);
  P.shake = us ? 1 : 0.4; flashScreen(us ? 0.7 : 0.3); updateScore(true);
  if (us) {
    if (r) { r.goals++; M.agentGoals[r.tag] = (M.agentGoals[r.tag] || 0) + 1; }
    P.cHome = 1; P.crowd = 1;
    banner(power ? 'SCREAMER!' : 'GOAL!', `${scorer.label} · ${minute()}'${power ? ' · deploy' : ''}`, '#b8ff3c');
    for (let i = 0; i < 6; i++) setTimeout(() => { confetti(scene, new V3(L - rnd(0, 3), 2.5, rnd(-5, 5)), 50); burst(scene, new V3(rnd(-L, L), 4, (Math.random() < 0.5 ? -1 : 1) * (W + 4)), [US.color, '#ffffff', scorer.color], 20, { speed: 0.15, up: 0.25 }); }, i * 260);
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.1, 1), i * 110)); roar(0.07);
    scorer.cele = 3; scorer.tgt.set(L - 2.5, 0, Math.sign(scorer.pos.z || 1) * (W - 2));
    for (const a of field()) if (a !== scorer) { a.cele = 2.6; a.tgt.copy(scorer.tgt).add(new V3(rnd(-2.5, -0.5), 0, rnd(-1.5, 1.5))); }
    say(`GOAL! ${scorer.label} scores${power ? ' a deploy screamer' : ''}! ${US.short} ${M.us}–${M.them} ${o.short}`, scorer.color);
    if (!demoMode) { REAL.today.goals++; B && B.submit(REAL.today.goals); }
    award('first_goal', true); award('screamer', power); award('super_sub', r && r.sub); award('hat', r && M.agentGoals[r.tag] >= 3);
  } else {
    P.cAway = 1; banner('GOAL', `${o.name} · ${minute()}'`, o.color); tone(200, 0.4, 'sawtooth', 0.06, 0.6);
    if (scorer) { scorer.cele = 2.6; scorer.tgt.set(-L + 4, 0, Math.sign(scorer.pos.z || 1) * (W - 2)); }
    say(`${o.name} score. ${US.short} ${M.us}–${M.them} ${o.short}`, o.color);
    if (!demoMode) REAL.today.conceded++;
  }
  save();
}
function startReplay() {
  if (!snapshot || snapshot.length < 30) return afterGoal();
  P.mode = 'replay'; rp = { f: snapshot, i: 0, side: M.scorers.at(-1).us ? 1 : -1, net: false };
  $('lbox').classList.add('on'); $('replay').classList.add('on'); document.body.classList.add('rp');
}
function afterGoal() {
  rp = null; $('lbox').classList.remove('on'); $('replay').classList.remove('on'); document.body.classList.remove('rp');
  for (const a of actors) { a.cele = 0; a.dive = null; a.mesh.rotation.z = 0; }
  const last = M.scorers.at(-1);
  if (M.us >= WIN_AT || M.them >= WIN_AT) return fullTime();
  kickoff(last && last.us ? 'them' : 'us');
}
function replayStep(rdt) {
  rp.i += rdt * 60 * 0.5;
  const k = Math.floor(rp.i); if (k >= rp.f.length - 1) return afterGoal();
  const f = rp.f[k], g = rp.f[k + 1], u = rp.i - k;
  ball.mesh.position.set(lerp(f.b[0], g.b[0], u), lerp(f.b[1], g.b[1], u), lerp(f.b[2], g.b[2], u));
  if (!rp.net && Math.abs(ball.mesh.position.x) > L + 0.3) { rp.net = true; ripple(rp.side, ball.mesh.position.z, ball.mesh.position.y); P.shake = 0.3; }
  for (const [a, x, y, z, ry, ph, run, rz] of f.a) { if (!a.mesh.parent) continue; a.mesh.position.set(x, y, z); a.mesh.rotation.y = ry; a.mesh.rotation.z = rz; a.mesh.run(ph, run); }
}

// ---------------------------------------------------------------- full time, league, trophies, kits
function poisson(l) { let k = 0, p = 1; const e = Math.exp(-l); do { k++; p *= Math.random(); } while (p > e); return k - 1; }
function record2(tab, a, b, ga, gb) {
  const A1 = tab[a], B1 = tab[b]; A1.p++; B1.p++; A1.gf += ga; A1.ga += gb; B1.gf += gb; B1.ga += ga;
  if (ga > gb) { A1.w++; A1.pts += 3; B1.l++; } else if (ga < gb) { B1.w++; B1.pts += 3; A1.l++; } else { A1.d++; B1.d++; A1.pts++; B1.pts++; }
}
const sorted = tab => Object.entries(tab).sort((x, y) => y[1].pts - x[1].pts || (y[1].gf - y[1].ga) - (x[1].gf - x[1].ga) || y[1].gf - x[1].gf);
let newBits = [];
function award(id, cond) {
  if (!cond) return; const d = D(); if (d.trophies.includes(id)) return;
  d.trophies.push(id); const t = TROPHIES.find(x => x[0] === id); newBits.push(`${t[1]} ${t[2]}`);
  toast(`${t[1]} Trophy: ${t[2]}${demoMode ? ' (demo)' : ''}`, 3500); save();
}
function checkKits() { const d = D(); for (const k of KITS) if (k.need >= 0 && d.career.pts >= k.need && !(d.kits || []).includes(k.id)) { d.kits = d.kits || ['classic']; d.kits.push(k.id); if (k.need > 0) newBits.push(`👕 ${k.name} kit`); } }
let ftTimer = 0;
function fullTime() {
  if (!M || M.ended) return;
  P.mode = 'ft'; M.ended = true; whistle(3); closeAim();
  const d = D(), lg = d.league, o = opp(), us = M.us, them = M.them, c = d.career;
  record2(lg.table, US.short, o.short, us, them);
  const rest = BOTS.filter(b => b.short !== o.short).sort(() => Math.random() - 0.5);
  for (let i = 0; i + 1 < rest.length; i += 2) record2(lg.table, rest[i].short, rest[i + 1].short, poisson(1 + (rest[i].str - rest[i + 1].str) * 2), poisson(1 + (rest[i + 1].str - rest[i].str) * 2));
  lg.md++;
  c.matches++; c.gf += us; c.ga += them;
  const res = us > them ? 'W' : us < them ? 'L' : 'D';
  if (res === 'W') { c.w++; c.pts += 3; } else if (res === 'D') { c.d++; c.pts++; } else c.l++;
  c.unbeaten = res === 'L' ? 0 : c.unbeaten + 1;
  if (!demoMode) { REAL.today.matches++; if (res === 'W') REAL.today.wins++; }
  award('first_win', res === 'W'); award('clean', res === 'W' && them === 0); award('comeback', res === 'W' && M.trailed);
  award('ten', c.gf >= 10); award('unbeaten', c.unbeaten >= 3);
  checkKits();
  const pos = sorted(lg.table).findIndex(([k]) => k === US.short) + 1;
  let seasonLine = '';
  if (lg.md >= 10) {
    if (pos === 1) { c.titles++; award('champ', true); d.kits = d.kits || ['classic']; if (!d.kits.includes('gold')) { d.kits.push('gold'); newBits.push('👕 Gilded kit'); } }
    seasonLine = `Season ${lg.season} over: you finished ${ord(pos)}${pos === 1 ? ' and lift the trophy!' : '.'}`;
    d.lastSeason = { season: lg.season, pos, table: sorted(lg.table) };
    d.league = freshLeague(lg.season + 1);
  }
  const motm = Object.entries(M.agentPasses).map(([k, v]) => [k, v + (M.agentGoals[k] || 0) * 6]).sort((a, b) => b[1] - a[1])[0];
  d.last = { us, them, opp: o.short, oppName: o.name, res, md: M.md, season: M.season, scorers: M.scorers, motm: motm ? motm[0] : null, pos, demo: demoMode };
  d.match = null; save(true);
  showFT(seasonLine);
}
const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
function tableHTML(tab) {
  return `<table class="lg"><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>${sorted(tab).map(([k, v], i) => `<tr class="${k === US.short ? 'me' : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${CLUB(k).color}"></span>${CLUB(k).name}</td><td>${v.p}</td><td>${v.w}</td><td>${v.d}</td><td>${v.l}</td><td>${v.gf - v.ga > 0 ? '+' : ''}${v.gf - v.ga}</td><td><b>${v.pts}</b></td></tr>`).join('')}</table>`;
}
function rankLine() { const p = B && B.profile(); if (!p || demoMode) return ''; let r = null; try { r = JSON.parse(localStorage.getItem('board_rank_agent-football')); } catch (e) {} return `${flag(p.country)} ${esc(p.name)}${r ? ` · #${r} today` : ''}`; }
function showFT(seasonLine) {
  const d = D(), l = d.last, o = CLUB(l.opp), el = $('ft');
  const goalsUs = l.scorers.filter(s => s.us).map(s => `${esc(s.label)} ${s.min}'${s.power ? ' 🚀' : ''}`).join(', ') || 'none';
  const lg = d.league, rk = rankLine();
  el.innerHTML = `<h2>${l.res === 'W' ? 'FULL TIME · WIN!' : l.res === 'D' ? 'FULL TIME · DRAW' : 'FULL TIME'}</h2>
    <div class="ftScore"><span>${US.short}</span><span class="num">${l.us} : ${l.them}</span><span style="color:${o.color}">${o.short}</span></div>
    <p class="ftLine">Goals: <b>${goalsUs}</b></p>
    ${l.motm ? `<p class="ftLine">Player of the match: <b>${esc(l.motm)}</b></p>` : ''}
    <p class="ftLine">${l.res === 'W' ? '+3 points' : l.res === 'D' ? '+1 point' : 'No points'} · ${ord(l.pos)} in the table${rk ? ` · ${rk}` : ''}</p>
    ${seasonLine ? `<p class="ftLine"><b>${seasonLine}</b></p>` : `<div class="season"><i style="width:${lg.md * 10}%"></i></div><p class="ftLine">Season ${lg.season}: matchday ${lg.md}/10 played</p>`}
    ${newBits.length ? `<div class="ftNew">${newBits.map(b => `<span>${b}</span>`).join('')}</div>` : ''}
    ${l.demo ? '<p class="ftLine">Demo friendly: connect your agents to play the real league.</p>' : ''}
    ${tableHTML(seasonLine && d.lastSeason ? Object.fromEntries(d.lastSeason.table) : lg.table)}
    <div class="ftBtns"><button class="big" id="ftNext">Next match</button><button class="ghost" id="ftShare">Share</button><button class="ghost" id="ftBoard">🏆 World</button><button class="ghost" id="ftClub">Club</button></div>`;
  newBits = [];
  el.hidden = false;
  let n = 30; const nb = $('ftNext');
  clearInterval(ftTimer); ftTimer = setInterval(() => { n--; nb.textContent = `Next match (${n})`; if (n <= 0) nextMatch(); }, 1000);
  nb.onclick = nextMatch; $('ftShare').onclick = share; $('ftBoard').onclick = () => B.open(); $('ftClub').onclick = () => openClub('table');
}
function hideFT() { clearInterval(ftTimer); $('ft').hidden = true; }
function nextMatch() { hideFT(); M = null; ensureMatch(demoMode); }

// ---------------------------------------------------------------- club panel
let clubTab = 'table';
function openClub(tab = clubTab) {
  clubTab = tab; const d = D(), body = $('clubBody');
  document.querySelectorAll('#club .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'table') body.innerHTML = `<p class="ftLine">Season ${d.league.season} · matchday ${d.league.md}/10 · titles won: <b>${d.career.titles}</b></p><div class="season"><i style="width:${d.league.md * 10}%"></i></div>${tableHTML(d.league.table)}<p class="ftLine">Career: ${d.career.matches} played · ${d.career.w}W ${d.career.d}D ${d.career.l}L · ${d.career.gf} goals · ${d.career.pts} pts</p>`;
  if (tab === 'trophies') body.innerHTML = `<div class="grid">${TROPHIES.map(([id, ic, n, how]) => `<div class="tro ${d.trophies.includes(id) ? '' : 'lock'}"><span class="ic">${ic}</span><b>${n}</b><small>${how}</small></div>`).join('')}</div>`;
  if (tab === 'kits') {
    const have = d.kits || ['classic'];
    body.innerHTML = `<p class="ftLine">Kits unlock with league points. Your agents keep their own shirt colours; the kit sets the shorts.</p><div class="grid">${KITS.map(k => `<button class="tro kit ${have.includes(k.id) ? '' : 'lock'} ${d.kit === k.id ? 'on' : ''}" data-kit="${k.id}"><span class="shorts" style="background:${k.shorts}"></span><b>${k.name}</b><small>${have.includes(k.id) ? (d.kit === k.id ? 'Wearing' : 'Tap to wear') : k.need < 0 ? 'Win a season' : `${k.need} pts`}</small></button>`).join('')}</div>`;
    body.querySelectorAll('[data-kit]').forEach(b => b.onclick = () => { if (!have.includes(b.dataset.kit)) return; d.kit = b.dataset.kit; applyKit(); save(); openClub('kits'); });
  }
  if (tab === 'today') {
    const t = REAL.today;
    body.innerHTML = `<p class="ftLine">What your agents did today (live connection only).</p><div class="stats"><div><b>${t.passes}</b><span>passes</span></div><div><b>${t.tests + t.commits}</b><span>tests + commits</span></div><div><b>${t.deploys}</b><span>deploys</span></div><div><b>${t.goals}</b><span>goals</span></div><div><b>${t.matches}</b><span>matches</span></div><div><b>${fmtK(t.tokens)}</b><span>tokens</span></div></div><p class="ftLine">${t.fails} turnovers · ${t.labels.length} project${t.labels.length === 1 ? '' : 's'}</p><div class="ftBtns"><button class="big" id="cShare">Share my agents' day</button></div>`;
    $('cShare').onclick = share;
  }
  $('club').hidden = false;
}
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : n;
document.querySelectorAll('#club .tabs button').forEach(b => b.onclick = () => openClub(b.dataset.tab));
$('club').querySelector('[data-close]').onclick = () => { $('club').hidden = true; };
function applyKit() { const k = KITS.find(x => x.id === D().kit) || KITS[0]; shortsMat.color.set(k.shorts); }

// ---------------------------------------------------------------- HUD
function updateScore(bump) {
  $('sUs').textContent = M ? M.us : 0; $('sThem').textContent = M ? M.them : 0;
  if (bump) { const s = document.querySelector('#sb .sc'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
}
function setTactic(t) { P.tactic = t; REAL.tactic = t; save(); document.querySelectorAll('#tactics button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); }
document.querySelectorAll('#tactics button').forEach(b => b.onclick = () => { setTactic(b.dataset.t); say(`Coach switches to ${TAC[b.dataset.t].name}`, '#ffffff'); tone(700, 0.06, 'triangle', 0.08, 1.2); });
setTactic(P.tactic);
$('bPep').onclick = () => {
  if (P.pepN <= 0 || P.pep > 0 || !M || P.mode === 'ft') return;
  P.pepN--; P.pep = 20; P.crowd = 1; banner('PEP TALK', 'Faster passes, wider corners, sharper saves for 20 s', '#ff8c42');
  for (const a of field()) { burst(scene, a.pos.clone().setY(1), [a.color, '#ffd23f'], 8, { speed: 0.06, up: 0.1 }); }
  [392, 523, 659].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.06, 1), i * 90)); say('Coach: "Come on, crew! One more!"', '#ff8c42');
};
$('bShare').onclick = share; $('bClub').onclick = () => openClub(); $('bBoard').onclick = () => B.open();
function hud() {
  $('pepN').textContent = P.pepN; $('pepBar').style.width = (P.meter * 100) + '%'; $('bPep').classList.toggle('live', P.pep > 0); $('bPep').disabled = P.pepN <= 0 && P.pep <= 0;
  $('clock').textContent = M ? (P.mode === 'ft' ? 'FT' : minute() + "'") : "0'";
  const m = $('mom'); m.classList.toggle('them', P.poss === 'them'); $('momFill').style.width = (P.p * 100) + '%'; $('momBall').style.left = (P.p * 100) + '%';
  const f = [...AG.values()].sort((a, b) => b.goals - a.goals || b.passes - a.passes);
  $('team').innerHTML = `<h4><span>${US.short} · ${f.length} agent${f.length === 1 ? '' : 's'}</span><span>⚽</span></h4>` + (f.length ? f.slice(0, 9).map(r => `<div class="r"><span class="d" style="background:${r.color}"></span><span class="n">${esc(r.tag)}${r.sub ? '<small>sub</small>' : ''}${r.actor ? '' : '<small>bench</small>'}${r.waiting ? ' 🙋' : ''}</span><span class="s">${r.passes}</span><span class="g">${r.goals ? '⚽' + r.goals : ''}</span></div>`).join('') + (f.length > 9 ? `<div class="r"><span></span><span class="n"><small>+${f.length - 9} more</small></span></div>` : '') : '<div class="r"><span></span><span class="n"><small>no agents on the pitch yet</small></span></div>');
  const calls = f.filter(r => r.waiting).slice(0, phone() ? 1 : 2);
  const key = calls.map(r => r.id).join();
  if ($('calls').dataset.k !== key) { $('calls').dataset.k = key; $('calls').innerHTML = calls.map(r => `<button class="call" data-id="${esc(r.id)}">🙋 ${esc(r.tag)} wants the coach</button>`).join(''); $('calls').querySelectorAll('.call').forEach(b => b.onclick = e => { e.stopPropagation(); answer(AG.get(b.dataset.id)); }); }
  $('wait').hidden = !(P.mode === 'wait' || (!demoMode && M && !AG.size && P.mode === 'play'));
}
function answer(r) {
  if (!r || !r.waiting) return; r.waiting = false; if (r.actor) { r.actor.raise = false; bubble(r.actor, 'on it!', '#b8ff3c'); }
  P.meter = Math.min(1, P.meter + 0.35); checkMeter();
  say(`Coach to ${r.tag}: "Good work. Back in your terminal they go."`, r.color); tone(660, 0.08, 'triangle', 0.08, 1.3);
}
function checkMeter() { if (P.meter >= 1) { if (P.pepN < 3) { P.pepN++; toast('📣 The crowd is roaring: +1 pep talk', 2500); } P.meter = 0; } }

// ---------------------------------------------------------------- agent events
const CATWORD = { edit: '✎ edit', read: 'read', run: 'run', test: 'tests', commit: 'commit', deploy: 'deploy!', web: 'web', delegate: 'sub on', other: 'tool' };
function handle(list, info) {
  const real = !info.demo;
  if (real) { rollToday(); if (demoMode || (M && M.demo)) leaveDemo(); for (const e of list) if (e.counted) tallyReal(e); }
  if (info.backfill) {
    let n = 0, sh = 0;
    for (const e of list) {
      if (e.kind === 'result' && e.ok) { n++; if (e.cat === 'test' || e.cat === 'commit' || e.cat === 'deploy') sh++; }
      if (e.live && e.kind !== 'end') { const r = agentRec(e); r.last = Math.max(r.last, e.t); if (e.kind === 'done') r.waiting = true; if (e.kind === 'prompt') r.waiting = false; }
    }
    for (const r of AG.values()) if (r.sub && Date.now() - r.last > 10 * 60e3) AG.delete(r.id);
    for (const r of AG.values()) { const a = onField(r); if (a && r.waiting) a.raise = true; }
    if (n) say(`Warm-up today: ${n} passes and ${sh} shots worth of agent work`, '#ffffff');
    save(); if (AG.size) ensureMatch(false);
    return;
  }
  if (!M || M.demo !== !real) { if (list.some(e => e.live)) ensureMatch(!real); else { if (real) save(); return; } }
  for (const e of list) {
    if (!e.live) continue;
    if (e.kind === 'end') { const r = AG.get(e.agent); if (r) dropAgent(r, `${r.tag} finished and jogs off`); continue; }
    const r = agentRec(e); r.last = Date.now();
    const a = onField(r);
    if (e.kind === 'tool') { if (a) bubble(a, CATWORD[e.cat] || toolName(e.tool), e.cat === 'deploy' ? '#ff8c42' : e.cat === 'test' || e.cat === 'commit' ? '#ffd23f' : '#ffffff'); }
    else if (e.kind === 'result') queue({ agent: e.agent, cat: e.cat, ok: e.ok });
    else if (e.kind === 'tokens') { P.meter = Math.min(1, P.meter + (e.tokens || 0) / 40000); checkMeter(); }
    else if (e.kind === 'think') { if (a && Math.random() < 0.3) bubble(a, '…', '#ffffff', '#16204a', 700); }
    else if (e.kind === 'done') { r.waiting = true; r.waitT = Date.now(); if (a) { a.raise = true; bubble(a, 'coach!', '#ffd23f', '#2a2008', 2500); } say(`🙋 ${r.tag} is waiting for you`, r.color); tone(990, 0.08, 'triangle', 0.07, 1.2); if (real) toast(`🙋 ${r.tag} finished and is waiting for you`, 3000); }
    else if (e.kind === 'prompt') { r.waiting = false; if (a) a.raise = false; }
  }
  if (real) save();
}
function leaveDemo() { for (const r of [...AG.values()]) dropAgent(r); M = null; demoMode = false; P.mode = 'wait'; Q.length = 0; closeAim(); hideFT(); dressRivals(); updateScore(); }
function tallyReal(e) {
  const t = REAL.today, c = REAL.career;
  if (e.kind === 'result') {
    if (!e.ok) t.fails++;
    else { t.passes++; c.passes++; if (e.cat === 'test') t.tests++; if (e.cat === 'commit') t.commits++; if (e.cat === 'deploy') t.deploys++; if (e.cat === 'test' || e.cat === 'commit' || e.cat === 'deploy') t.shots++; }
  }
  if (e.kind === 'tokens') t.tokens += e.tokens || 0;
  if (e.label && !t.labels.includes(e.label) && t.labels.length < 50) t.labels.push(e.label);
}

let B = null;
const A = agents({
  game: 'agent-football', title: 'KICKOFF CREW', accent: '#b8ff3c', demoAgents: 4,
  tagline: 'A football match where your AI agents are the team.',
  about: 'Every coding agent you run walks out as a player in its own colour. Edits are through balls, reads are short passes, runs are dribbles, web lookups are long balls. A failed step is a turnover. Passing tests and commits are shots, deploys are screamers. You coach: pick tactics, give pep talks, time every finish and dive for every save.',
  onEvents(list, info) { B && B.onAgentEvents(list); handle(list, info); },
  onConnect() { if (demoMode) leaveDemo(); },
});
B = board({ game: 'agent-football', label: 'Goals', A });
window.__A = window.A = A;
Object.defineProperty(window, 'tally', { get: () => ({ today: { ...REAL.today, labels: REAL.today.labels.length }, careerPasses: REAL.career.passes, match: M && { us: M.us, them: M.them, clock: Math.round(M.clock), passes: M.passes, demo: M.demo }, agents: AG.size }) });
window.__feed = (list, info = {}) => handle(list, info);
window.__kc = { P, aim, get M() { return M; }, tap: coachTap, fullTime, open: openClub };   // QA hooks
$('bConnect').onclick = () => A.open();
if (REAL.today.goals) B.submit(REAL.today.goals);
applyKit(); dressRivals(); updateScore();

// coach input: any tap resolves a shot/save; taps on a waving player answer them
const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('.chip, .seg, .modal, .ag-card, .bd-wrap, .call, .ag-demo, .ag-toast')) return;
  if (aim.on) { coachTap(); return; }
  mv.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mv, camera);
  for (const a of field()) if (a.rec && a.rec.waiting && ray.intersectObject(a.mesh, true).length) return answer(a.rec);
});
addEventListener('keydown', e => { if ((e.code === 'Space' || e.code === 'Enter') && aim.on) { e.preventDefault(); coachTap(); } });

// ---------------------------------------------------------------- share card
async function share() {
  renderer.render(scene, camera);
  const [c, g] = cv(1200, 630), src = renderer.domElement, sr = src.width / src.height, tr = 1200 / 630;
  let sw = src.width, sh = src.height; if (sr > tr) sw = sh * tr; else sh = sw / tr;
  g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 1200, 630);
  const gr = g.createLinearGradient(0, 0, 0, 630); gr.addColorStop(0, 'rgba(14,18,44,.85)'); gr.addColorStop(0.45, 'rgba(14,18,44,.25)'); gr.addColorStop(1, 'rgba(14,18,44,.92)'); g.fillStyle = gr; g.fillRect(0, 0, 1200, 630);
  g.fillStyle = '#ffffff'; g.font = '44px Bungee, Impact, sans-serif'; g.fillText('KICKOFF', 48, 80); g.fillStyle = '#b8ff3c'; g.fillText('CREW', 48 + g.measureText('KICKOFF ').width, 80);
  g.fillStyle = '#c7cbe6'; g.font = '800 26px "Baloo 2", system-ui'; g.fillText('My AI agents today', 50, 118);
  const d = D(), l = M && (M.us || M.them || M.clock > 20) ? { us: M.us, them: M.them, opp: M.opp, live: true } : d.last;
  if (l) {
    const o = CLUB(l.opp); g.font = '64px Bungee, Impact, sans-serif'; g.textAlign = 'right'; g.fillStyle = '#fff';
    g.fillText(`${US.short} ${l.us}–${l.them} ${o.short}`, 1150, 92); g.textAlign = 'right'; g.font = '800 24px "Baloo 2", system-ui'; g.fillStyle = '#c7cbe6';
    g.fillText(l.live ? `Live · ${minute()}' vs ${o.name}` : `Full time vs ${o.name}`, 1150, 126); g.textAlign = 'left';
  }
  const t = REAL.today, stats = demoMode ? [[M ? M.passes : 0, 'passes'], [M ? M.shots : 0, 'shots'], [M ? M.us : 0, 'goals'], [AG.size, 'agents']] : [[t.passes, 'passes'], [t.tests + t.commits + t.deploys, 'shots'], [t.goals, 'goals'], [Math.max(t.labels.length, AG.size), 'projects']];
  stats.forEach(([v, k], i) => { const x = 50 + i * 280; g.fillStyle = 'rgba(14,18,44,.8)'; g.beginPath(); g.roundRect(x, 470, 250, 110, 20); g.fill(); g.fillStyle = '#b8ff3c'; g.font = '56px Bungee, Impact, sans-serif'; g.fillText(fmtK(v), x + 22, 535); g.fillStyle = '#c7cbe6'; g.font = '800 24px "Baloo 2", system-ui'; g.fillText(k, x + 24, 566); });
  const top = [...AG.values()].sort((a, b) => b.goals - a.goals || b.passes - a.passes)[0];
  g.font = '800 26px "Baloo 2", system-ui'; g.fillStyle = '#fff';
  const lg = d.league, pos = sorted(lg.table).findIndex(([k]) => k === US.short) + 1;
  g.fillText(`Season ${lg.season} · ${ord(pos)} in the league${top ? ` · star: ${top.tag}` : ''}${demoMode ? ' · demo' : ''}`, 50, 452);
  const rk = rankLine(); if (rk) { g.textAlign = 'right'; g.fillText(rk.replace(/&amp;/g, '&').replace(/&lt;/g, '<'), 1150, 452); g.textAlign = 'left'; }
  g.fillStyle = '#c7cbe6'; g.font = '800 20px "Baloo 2", system-ui'; g.textAlign = 'right'; g.fillText('riffcade.com', 1150, 608); g.textAlign = 'left';
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'kickoff-crew.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: 'My AI agents today', text: 'My AI agents played football today', url: location.href.split('?')[0] }); } catch (e) { return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kickoff-crew.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------------------------------------------------------------- per frame
const camPos = new V3(0, 16, 24), camLook = new V3(), tmp = new V3();
let lastSweep = 0;
function moveActor(a, dt, t) {
  if (a.leaving > 0) { a.leaving -= dt; if (a.leaving <= 0) return removeActor(a); }
  if (a.lock > 0) a.lock -= dt;
  if (a.cele > 0) a.cele -= dt;
  tmp.subVectors(a.tgt, a.pos); tmp.y = 0; const dist = tmp.length(), sp = a.speed * (a.team === 'us' && P.pep > 0 ? 1.18 : 1) * (a.cele > 0 ? 1.2 : 1);
  if (dist > 0.06) { const step = Math.min(dist, sp * dt); a.pos.addScaledVector(tmp, step / dist); a.run = lerp(a.run, clamp(dist / 1.0, 0, 1), 0.15); a.face = Math.atan2(tmp.x, tmp.z); }
  else { a.run = lerp(a.run, 0, 0.12); a.face = Math.atan2(ball.pos.x - a.pos.x, ball.pos.z - a.pos.z); }
  let dr = a.face - a.mesh.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); a.mesh.rotation.y += dr * Math.min(1, dt * 10);
  a.phase += dt * a.run; a.mesh.run(a.phase, a.run);
  let y = 0;
  a.mesh.armR.rotation.z = 0; a.mesh.armL.rotation.z = 0; a.mesh.rotation.z = 0;
  if (a.cele > 0) { y = Math.abs(Math.sin(t * 9 + a.seed)) * 0.45; a.mesh.armR.rotation.x = a.mesh.armL.rotation.x = 0; a.mesh.armR.rotation.z = 2.6; a.mesh.armL.rotation.z = -2.6; }
  else if (a.raise) { a.mesh.armR.rotation.x = 0; a.mesh.armR.rotation.z = 2.7 + Math.sin(t * 8) * 0.3; }
  if (a.dive) {
    a.dive.t += dt; const k = clamp(a.dive.t / 0.35, 0, 1), back = a.dive.t > 1.4 ? clamp((a.dive.t - 1.4) / 0.5, 0, 1) : 0;
    a.pos.z = lerp(a.pos.z, clamp(a.dive.z, -GW, GW), Math.min(1, dt * 9) * (a.dive.t > 0 ? 1 : 0));
    const side = a.keeper && a === rivalKeeper ? -a.dive.side : a.dive.side;
    a.mesh.rotation.z = side * 1.25 * k * (1 - back); y = Math.sin(k * PI) * 0.5 * (1 - back); a.mesh.armL.rotation.z = -2.8 * k; a.mesh.armR.rotation.z = 2.8 * k;
    if (a.dive.t > 2) a.dive = null;
  }
  // squash + stretch on the jump
  a.mesh.position.set(a.pos.x, y, a.pos.z); a.mesh.scale.set(1, 1 + y * 0.12, 1);
  if (a.bub && a.bubT > 0) { a.bubT -= dt; if (a.bubT <= 0) a.bub.visible = false; }
  if (a.rec) { const m = a.mesh.body.material; const glow = (P.pep > 0 ? 0.35 + Math.sin(t * 10) * 0.12 : 0) + (a.glow ? 0.4 : 0); m.emissive.set(a.color); m.emissiveIntensity = glow; }
}
function updateBall(dt, t) {
  if (ball.fl) {
    const f = ball.fl; f.t += dt; const k = Math.min(1, f.t / f.dur);
    ball.pos.lerpVectors(f.from, f.to, k); ball.pos.y = lerp(f.from.y, f.to.y, k) + 4 * f.h * k * (1 - k);
    ball.mesh.rotation.x += dt * 18; ball.mesh.rotation.z += dt * 9;
    if (P.mode === 'shot' && Math.random() < 0.6) burst(scene, ball.pos.clone(), ['#ffffff', '#ffd23f'], 1, { speed: 0.01, up: 0.005, size: 0.6, gravity: 0, life: 0.5 });
    if (k >= 1) { ball.fl = null; f.onLand && f.onLand(); }
  } else if (ball.owner) {
    const o = ball.owner, fx = Math.sin(o.mesh.rotation.y), fz = Math.cos(o.mesh.rotation.y);
    tmp.set(o.pos.x + fx * 0.42, 0.21 + Math.abs(Math.sin(o.phase * 6)) * 0.08 * o.run, o.pos.z + fz * 0.42);
    ball.pos.lerp(tmp, Math.min(1, dt * 14)); ball.mesh.rotation.x += dt * o.run * 10;
  }
  ball.mesh.position.copy(ball.pos);
}
function updateCamera(dt, t) {
  const ph = phone(); let pos, look;
  if (P.mode === 'replay' && rp) {
    const s = rp.side, b = ball.mesh.position;
    pos = new V3(clamp(b.x - s * 6, -L + 2, L - 2), ph ? 5 : 3.4, b.z + (ph ? 3 : 8)); look = new V3(lerp(b.x, s * L, 0.3), 1, b.z * 0.8);
    camPos.lerp(pos, 1 - Math.exp(-dt * 3)); camLook.lerp(look, 1 - Math.exp(-dt * 5));
  } else {
    if (P.mode === 'ft' || !M) { const an = t * 0.08; pos = new V3(Math.sin(an) * 30, 17, Math.cos(an) * 30); look = new V3(0, 0, 0); }
    else if ((P.mode === 'aim' || P.mode === 'shot') && aim.shooter && !aim.save) { const s = aim.shooter.pos; pos = new V3(Math.min(s.x, L - 8) - (ph ? 9 : 9), ph ? 7.5 : 6, s.z * 0.6 + (ph ? 0 : 5)); look = new V3(L - 1, 0.6, s.z * 0.25); }
    else if ((P.mode === 'aim' || P.mode === 'shot') && aim.save) { pos = new V3(-L - (ph ? 9 : 8), ph ? 8 : 6.5, ph ? 0 : 3); look = new V3(-L + 9, 0.5, ball.pos.z * 0.4); }
    else if (P.mode === 'goal') { const s = M.scorers.at(-1), sc = s && s.us ? field().find(a => a.label === s.label) : null, c = sc ? sc.pos : ball.pos; pos = new V3(c.x - (ph ? 8 : 5), ph ? 9 : 6, c.z * 0.6 + (ph ? 0 : 10)); look = c.clone().setY(ph ? 3.2 : 2.6); }
    else if (ph) { const bx = clamp(ball.pos.x, -12, 12); pos = new V3(bx - 9.5, 18.5, ball.pos.z * 0.5); look = new V3(bx + 3.5, 0, ball.pos.z * 0.6); }
    else { const bx = clamp(ball.pos.x * 0.85, -9.5, 9.5); pos = new V3(bx, 15.5, 22.5); look = new V3(bx, 0, 1.2); }
    camPos.lerp(pos, 1 - Math.exp(-dt * 2.6)); camLook.lerp(look, 1 - Math.exp(-dt * 3.5));
  }
  camera.position.copy(camPos);
  if (P.shake > 0) { camera.position.x += rnd(-1, 1) * P.shake * 0.5; camera.position.y += rnd(-1, 1) * P.shake * 0.35; P.shake = Math.max(0, P.shake - dt * 1.6); }
  camera.lookAt(camLook);
}
let hudT = 0, recT = 0, last = performance.now();
loop((dt60, t) => {
  const now = performance.now(), rdt = Math.min(0.05, (now - last) / 1000); last = now;
  const target = P.mode === 'aim' ? 0.22 : P.ts; P.tsCur = lerp(P.tsCur || 1, target, 0.15);
  const dt = rdt * P.tsCur;
  aimUpdate(rdt);
  if (P.mode === 'replay' && rp) replayStep(rdt);
  else {
    // the match engine
    if (M && P.mode === 'play' && !M.ended) {
      const running = demoMode || AG.size > 0;
      if (running) {
        M.clock += dt; P.shotCd -= dt;
        if (P.pep > 0) P.pep -= dt;
        if (P.poss === 'them' && P.holder && !ball.fl) {
          P.p -= dt * 0.08 * (0.7 + opp().str) * TAC[P.tactic].rival;
          P.rivalPassT -= dt;
          if (P.rivalPassT <= 0 && !P.holder.keeper) { P.rivalPassT = rnd(1.4, 2.4); const to = pick(rivals.filter(r => r !== P.holder)); const dest = new V3(xOf(Math.max(0.1, P.p - 0.05)), 0.21, clamp(to.pos.z, -9, 9)); to.tgt.copy(dest).setY(0); to.lock = 0.8; to.hz = dest.z; kick(dest, 0.55, 0.2, () => give(to)); P.holder = null; }
          if (P.holder && P.holder.keeper) { P.rivalPassT -= dt; if (P.rivalPassT <= -0.6) { const to = rivals[(Math.random() * 4) | 0]; P.p = 0.62; const dest = new V3(xOf(0.62), 0.21, clamp(to.pos.z, -8, 8)); to.tgt.copy(dest).setY(0); to.lock = 1.3; kick(dest, 1.1, 3.5, () => give(to)); P.holder = null; P.rivalPassT = 1.5; } }
          if (P.p <= 0.12 && P.holder && !P.holder.keeper) startSave();
        } else if (P.poss === 'them' && !P.holder && !ball.fl) loseBall();
        if (P.poss === 'us' && !ball.fl) { if (!P.holder || !P.holder.mesh.parent || (P.holder.rec == null && !P.holder.keeper)) { const l = field(); if (l.length) give(nearest(l, ball.pos)); else loseBall(); } P.idle += dt; if (P.idle > 22) { loseBall(); say(`${opp().short} intercept: the crew went quiet`, opp().color); } }
        if (P.holder === ourKeeper && !ball.fl) { const l = field(); if (l.length) { const to = nearest(l, new V3(-8, 0, 0)); kick(new V3(xOf(0.25), 0.21, to.pos.z * 0.5), 0.8, 1.5, () => give(to)); to.tgt.set(xOf(0.25), 0, to.pos.z * 0.5); to.lock = 1; P.holder = null; P.p = 0.25; } }
        if (Q.length && !ball.fl) { qT -= dt; if (qT <= 0) { doAction(Q.shift()); qT = Q.length > 4 ? 0.35 : 0.7; } }
        if (M.clock >= MATCH) fullTime();
        if (!demoMode) { recT += dt; if (recT > 3) { recT = 0; save(); } }
      }
    }
    if (P.mode === 'goal') { P.modeT -= rdt; if (P.modeT <= 0) startReplay(); }
    if (!M && AG.size === 0) { P.mode = 'wait'; }
    if (P.mode === 'wait' && P.holder == null && !ball.fl) give(rivals[4]);
    if (P.mode === 'wait' || (!demoMode && M && AG.size === 0)) { // rivals knock it about in the warm-up
      P.rivalPassT -= dt; if (P.rivalPassT <= 0 && !ball.fl) { P.rivalPassT = rnd(1.2, 2); const to = pick(rivals.filter(r => r !== P.holder)); kick(to.pos.clone().setY(0.21), 0.6, 0.3, () => give(to)); P.holder = null; }
    }
    formation(t, false);
    for (const a of [...actors]) moveActor(a, dt, t);
    updateBall(dt, t);
    if (P.mode !== 'replay') { record(); }
    // inactive agents leave after 10 minutes of silence
    if ((t | 0) !== lastSweep) { lastSweep = t | 0; for (const r of [...AG.values()]) { if (Date.now() - r.last > 10 * 60e3) dropAgent(r, `${r.tag} heads to the bench (quiet for 10 min)`); if (demoMode && r.waiting && Date.now() - r.waitT > 12e3) { r.waiting = false; if (r.actor) r.actor.raise = false; } } }
  }
  updateNets(rdt);
  P.crowd = Math.max(0.15, P.crowd - rdt * 0.2); P.cHome = Math.max(0, P.cHome - rdt * 0.3); P.cAway = Math.max(0, P.cAway - rdt * 0.3);
  crowd.update(t);
  for (const b of boards) b.offset.x = (b.offset.x + rdt * 0.02) % 1;
  for (const f of flashes) { if (f.material.opacity > 0) f.material.opacity -= rdt * 6; else if (Math.random() < 0.004 + P.crowd * 0.02 + (P.cHome + P.cAway) * 0.05) { const p = pick(crowd.pos); f.position.set(p[0], p[1] + 0.6, p[2]); f.material.opacity = 1; } }
  updateCamera(rdt, t);
  hudT -= rdt; if (hudT <= 0) { hudT = 0.25; hud(); }
});

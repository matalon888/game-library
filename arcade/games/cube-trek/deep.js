// Cube Trek — deep v2. Same 8×8 block puzzle (drag one of three pieces, full rows/columns burst, free the gems) turned into a
// hand-made puzzle quest: 30 authored levels in 3 worlds (levels.js) with exact trays, a move limit, a par, ice that needs two
// clears and bombs that blow up their neighbours (rules.js), stars, a level map, crystal chests with block skins, a daily dig.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { LEVELS, WORLDS, PARS } from './levels.js';
import { SH, N, fits, anyFit, place as rplace, needs, done as rdone, count, dims } from './rules.js';

const WB = worldBoard({ game: 'cube-trek', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 2 }, mode: 'sum' });
const S = store('cubetrek-d');
const F = flow('cubetrek');
const stage = createStage({ fov: 34, shadowSize: 12 });
const { scene, camera, renderer, sun, hemi } = stage;
const ui = createUI({ title: 'CUBE<br>TREK', hint: 'Tap the glowing gap', hand: '👆' });
ui.hideStart();
hemi.intensity = 1.2; hemi.color.set('#ffffff'); hemi.groundColor.set('#8ea0ff');
sun.intensity = 1.9; sun.position.set(-7, 9, 16); sun.target.position.set(0, 0, 0);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14 }); sun.shadow.camera.updateProjectionMatrix();

// ------------------------------------------------------------------ layout
const BOARD_Y = 2.0, TRAY_Y = -7.0, TRAY_S = 0.64, SLOT_X = [-3.3, 0, 3.3];
const cellPos = (r, c) => [(c - 3.5), BOARD_Y + (3.5 - r)];
function fitCamera() {
  const fov = camera.fov * Math.PI / 180, t = Math.tan(fov / 2);
  const d = Math.max(10.0 / (2 * t * camera.aspect), 22.4 / (2 * t));
  camera.position.set(0, -4.2, d); camera.lookAt(0, -0.2, 0);
}
addEventListener('resize', fitCamera); fitCamera();

// ------------------------------------------------------------------ skins (unlocked from crystal chests)
const SKINS = [
  { name: 'Classic', c: ['#a24dff', '#1fc8f2', '#2f6bff', '#2fd05a', '#ff3b55', '#ffb21e', '#ff6fb5'] },
  { name: 'Candy', c: ['#ff6fb5', '#ffa3d2', '#ff3b7a', '#ffd23f', '#c77dff', '#7dffb2', '#ff9a76'] },
  { name: 'Ocean', c: ['#1fc8f2', '#2f6bff', '#00a6a6', '#5ce1e6', '#3a56d4', '#7bdff2', '#0b7a9e'] },
  { name: 'Forest', c: ['#2fd05a', '#8ac926', '#1b9e4b', '#c9e265', '#0f8a6a', '#5bbf7a', '#a7d129'] },
  { name: 'Sunset', c: ['#ff5d3b', '#ffb21e', '#ff3b7a', '#ff8a3d', '#ffd166', '#e63946', '#f4a261'] },
  { name: 'Neon', c: ['#00f5d4', '#f15bb5', '#fee440', '#9b5de5', '#00bbf9', '#ff6b35', '#b8f400'] },
  { name: 'Candle', c: ['#ffe9a8', '#ffd166', '#f4a261', '#fff1c9', '#e9c46a', '#ffcf99', '#ffb86b'] },
  { name: 'Shadow', c: ['#7a7fa8', '#5b5f8a', '#9aa0c8', '#4a4e75', '#8d93bd', '#6d7299', '#a9afd6'] },
];
let skinOwned = S.get('skins', [0]), skinOn = S.get('skin', 0);
const pal = () => SKINS[skinOn].c;

// ------------------------------------------------------------------ meshes
const BLOCK_G = rounded(0.94, 0.94, 0.62, 0.13), FACE_G = rounded(0.6, 0.6, 0.04, 0.1);
const blockMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.05 });
const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.05 });
const MAXI = 300;
const blocks = new THREE.InstancedMesh(BLOCK_G, blockMat, MAXI), faces = new THREE.InstancedMesh(FACE_G, faceMat, MAXI);
blocks.castShadow = true; blocks.receiveShadow = true;
for (let i = 0; i < MAXI; i++) { blocks.setColorAt(i, new THREE.Color('#fff')); faces.setColorAt(i, new THREE.Color('#fff')); }
blocks.frustumCulled = faces.frustumCulled = false; scene.add(blocks, faces);
const ghost = new THREE.InstancedMesh(BLOCK_G, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), 40);
ghost.frustumCulled = false; ghost.count = 0; scene.add(ghost);
const GEM_G = new THREE.OctahedronGeometry(0.36, 0); GEM_G.scale(1, 1.2, 0.75);
const gemMat = new THREE.MeshStandardMaterial({ color: '#9ff0ff', emissive: '#19a8ff', emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.35, flatShading: true });
const gems = new THREE.InstancedMesh(GEM_G, gemMat, 90); gems.castShadow = true; gems.frustumCulled = false; gems.count = 0; scene.add(gems);
const bombG = new THREE.SphereGeometry(0.3, 14, 10);
const bombMat = new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff4a00', emissiveIntensity: 1.2, roughness: 0.3 });
const bombs = new THREE.InstancedMesh(bombG, bombMat, 64); bombs.frustumCulled = false; bombs.count = 0; scene.add(bombs);
const crackG = new THREE.BoxGeometry(0.78, 0.07, 0.05);
const cracks = new THREE.InstancedMesh(crackG, new THREE.MeshBasicMaterial({ color: '#1d4a78' }), 130); cracks.frustumCulled = false; cracks.count = 0; scene.add(cracks);
const shineG = new THREE.PlaneGeometry(0.34, 0.12);
const shines = new THREE.InstancedMesh(shineG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), 64); shines.frustumCulled = false; shines.count = 0; scene.add(shines);
{
  const tray = new THREE.Mesh(rounded(8.6, 8.6, 0.5, 0.35), new THREE.MeshStandardMaterial({ color: '#141b46', roughness: 0.55 }));
  tray.position.set(0, BOARD_Y, -0.55); tray.receiveShadow = true; scene.add(tray);
  const rim = new THREE.Mesh(rounded(8.95, 8.95, 0.4, 0.42), new THREE.MeshStandardMaterial({ color: '#2a3aa8', roughness: 0.4 })); rim.position.set(0, BOARD_Y, -0.72); scene.add(rim);
  const sock = new THREE.InstancedMesh(rounded(0.92, 0.92, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: '#1d2760', roughness: 0.7 }), 64);
  const m = new THREE.Matrix4(); let i = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const [x, y] = cellPos(r, c); m.makeTranslation(x, y, -0.29); sock.setMatrixAt(i++, m); }
  sock.receiveShadow = true; scene.add(sock);
  const shelf = new THREE.Mesh(rounded(10.2, 3.6, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: '#2d2a9e', roughness: 0.6, transparent: true, opacity: 0.55 }));
  shelf.position.set(0, TRAY_Y, -0.7); shelf.receiveShadow = true; scene.add(shelf);
}

// ------------------------------------------------------------------ state
// bs = 64-char board string (rules.js); vis[i] = { ci: colour index, pop }.  cur = the level being played.
let cur = null, bs = '', vis = [], tray = [], dealIdx = 0, movesLeft = 0, used = 0, got = { gems: 0, ice: 0, lines: 0 }, need = null;
let state = 'map', combo = 0, drag = null, sel = null, anims = [], flyers = [], botMove = null, settle = 0, idleT = 0, hintCache = null, shock = [];
let rand = rng(1);
const day = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const stars = () => S.get('stars', {});                // { levelNumber: 1..3 }
const reach = () => S.get('reach', 1);                 // highest unlocked level
const totalStars = () => Object.values(stars()).reduce((a, b) => a + b, 0);
const worldOf = n => WORLDS.find(w => n >= w.from && n <= w.to) || WORLDS[2];

// random levels: after level 30 ("Deep Dig") and the daily dig. Seeded, rubble rising from the bottom, gems on the fullest rows.
function genLevel(n, seed, name) {
  const r = rng(seed * 7919 + n * 131 + 5), g = Array.from({ length: N }, () => Array(N).fill('.')), lv = Math.min(30, n - 30 + 4);
  const fill = Math.min(0.72, 0.42 + lv * 0.01), hs = [];
  for (let c = 0; c < N; c++) hs.push(Math.floor(r() * (2 + fill * 8)));
  for (let c = 0; c < N; c++) for (let q = N - 1; q >= N - hs[c]; q--) if (r() < 0.86) g[q][c] = '#';
  for (let q = 0; q < N; q++) if (g[q].every(x => x !== '.')) g[q][Math.floor(r() * N)] = '.';
  for (let c = 0; c < N; c++) if (g.every(row => row[c] !== '.')) g[Math.floor(r() * N)][c] = '.';
  const filled = []; for (let q = 0; q < N; q++) for (let c = 0; c < N; c++) if (g[q][c] !== '.') filled.push([q, c]);
  filled.sort((a, b) => g[b[0]].filter(x => x !== '.').length - g[a[0]].filter(x => x !== '.').length + (r() - 0.5) * 3);
  const want = Math.min(filled.length, 3 + Math.floor(lv * 0.25), 8);
  for (let i = 0; i < want; i++) g[filled[i][0]][filled[i][1]] = 'G';
  if (lv > 6 && filled.length > want + 2) { const [a, b] = filled[want]; g[a][b] = 'B'; }
  return { n, name, purpose: '', goal: 'gems', moves: 12, deals: [], board: g.map(x => x.join('')), endless: true };
}
const levelOf = n => n <= LEVELS.length ? LEVELS[n - 1] : genLevel(n, 11, 'Deep Dig ' + (n - 30));

function dealFrom(names, i) {
  return names.map((k, s) => ({ cells: SH[k], ci: (i * 3 + s * 2 + (cur.n % 5)) % 7, slot: s, used: false, pop: -s * 0.08 }));
}
function randomDeal() {
  const names = Object.keys(SH).filter(k => !['sq3', 'bigL', 'bigJ', 'h5', 'v5'].includes(k) || rand() < 0.2), out = [];
  for (let s = 0; s < 3; s++) {
    let k = null; for (let t = 0; t < 40; t++) { const c = names[Math.floor(rand() * names.length)]; if (s === 0 ? anyFit(bs, SH[c]) : (rand() < 0.6 ? anyFit(bs, SH[c]) : true)) { k = c; break; } }
    out.push({ cells: SH[k || 'd'], ci: Math.floor(rand() * 7), slot: s, used: false, pop: -s * 0.08 });
  }
  return out;
}
function dealTray() {
  hintCache = null; dealIdx++;
  tray = cur.deals && dealIdx < cur.deals.length ? dealFrom(cur.deals[dealIdx], dealIdx) : randomDeal();
  sfx.pick(2);
}

// ------------------------------------------------------------------ level start
function startLevel(n, opts = {}) {
  hideCards(); closeMap();
  cur = opts.daily ? { ...genLevel(31 + (day() % 9), day(), 'Daily Dig'), daily: true, n: 0 } : { ...levelOf(n) };
  rand = rng((opts.daily ? day() : n) * 4513 + 7);
  bs = cur.board.join(''); vis = []; for (let i = 0; i < 64; i++) vis.push({ ci: (Math.floor(i / 8) * 3 + i % 8) % 7, pop: -((N - Math.floor(i / 8)) * 0.04 + (i % 8) * 0.015) });
  need = needs(cur); got = { gems: 0, ice: 0, lines: 0 }; movesLeft = cur.moves; used = 0; dealIdx = 0; combo = 0; anims = []; flyers = []; shock = []; drag = null; sel = null; botMove = null; idleT = 0; hintCache = null; settle = 0;
  tray = cur.deals && cur.deals.length ? dealFrom(cur.deals[0], 0) : randomDeal();
  state = 'play'; ui.levels(cur.daily ? '🌟' : n); ui.score(''); ui.els.sc.classList.add('hc-hidden'); F.k();
  document.body.dataset.world = worldOf(cur.n || 31).id;
  refreshHud(); sfx.pick(2);
  const tip = !cur.daily && (cur.purpose && !cur.purpose.startsWith('HARD') ? cur.purpose.replace(/^BOSS: /, '') : cur.purpose);
  setTimeout(() => { if (cur && state === 'play' && used === 0) coach.say((cur.boss ? '👑 ' : cur.hard ? '🔥 ' : '') + (cur.daily ? 'Daily Dig: same board for everyone today' : tip), 63, 4500); }, 500);
}

// ------------------------------------------------------------------ HUD: goal, move pips
const goalEl = document.createElement('div'); goalEl.className = 'ct-goal'; document.body.appendChild(goalEl);
const pipEl = document.createElement('div'); pipEl.className = 'ct-pips'; document.body.appendChild(pipEl);
const nameEl = document.createElement('div'); nameEl.className = 'ct-name'; document.body.appendChild(nameEl);
const btnR = document.createElement('button'); btnR.className = 'ct-ib l'; btnR.textContent = '🔄'; document.body.appendChild(btnR);
const btnM = document.createElement('button'); btnM.className = 'ct-ib r'; btnM.textContent = '🗺️'; document.body.appendChild(btnM);
function refreshHud(bump) {
  const parts = [];
  if (need.gems) parts.push(`<span class="gem"></span>${Math.min(got.gems, need.gems)}/${need.gems}`);
  if (need.ice) parts.push(`<span class="ice"></span>${Math.min(got.ice, need.ice)}/${need.ice}`);
  goalEl.innerHTML = parts.join('<i></i>');
  const tot = need.gems + need.ice, have = Math.min(got.gems, need.gems) + Math.min(got.ice, need.ice); ui.progress(tot ? have / tot : 0);
  let h = ''; for (let i = 0; i < cur.moves; i++) h += `<b class="${i < movesLeft ? 'on' : ''}${movesLeft <= 3 && i < movesLeft ? ' low' : ''}"></b>`;
  pipEl.innerHTML = h;
  const w = cur.daily ? null : worldOf(cur.n);
  nameEl.textContent = cur.daily ? '🌟 DAILY DIG' : `${cur.boss ? '👑 ' : cur.hard ? '🔥 ' : ''}${cur.name}${w && cur.n <= 30 ? '' : ''}`;
  if (bump) { goalEl.classList.remove('bump'); void goalEl.offsetWidth; goalEl.classList.add('bump'); }
}
btnR.onclick = () => { if (cur && state !== 'map') startLevel(cur.daily ? 0 : cur.n, { daily: cur.daily }); };
btnM.onclick = () => openMap();

// ------------------------------------------------------------------ solver (hints, QA bot): shortest winning line over the authored deals
function solveFrom(maxNodes = 90000) {
  if (!cur) return null;
  const deals = (cur.deals && cur.deals.length ? cur.deals : []).slice(dealIdx).map((d, k) => k === 0 ? tray.map(p => p.used ? null : p.cells) : d.map(x => SH[x]));
  if (!deals.length) deals.push(tray.map(p => p.used ? null : p.cells));
  let nodes = 0, sol = null; const seen = new Map();
  const dfs = (b, di, mask, g, left, path) => {
    if (rdone(need, g)) { sol = path.slice(); return true; }
    if (left === 0 || di >= deals.length || nodes > maxNodes) return false;
    const key = b + di + mask + g.gems + g.ice; if ((seen.get(key) || -1) >= left) return false; seen.set(key, left); nodes++;
    for (let i = 0; i < 3; i++) {
      if ((mask & (1 << i)) || !deals[di][i]) continue; const cells = deals[di][i], tried = new Set();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (!fits(b, cells, r, c)) continue; const o = rplace(b, cells, r, c); if (tried.has(o.b)) continue; tried.add(o.b);
        let m2 = mask | (1 << i), d2 = di; if (m2 === 7 || deals[di].every((x, j) => !x || (m2 & (1 << j)))) { m2 = 0; d2 = di + 1; }
        path.push([i, r, c, di]); if (dfs(o.b, d2, m2, { gems: g.gems + o.gems, ice: g.ice + o.ice, lines: g.lines + o.lines }, left - 1, path)) return true; path.pop();
      }
    }
    return false;
  };
  for (let k = 1; k <= movesLeft && !sol; k++) { seen.clear(); nodes = 0; dfs(bs, 0, 0, got, k, []); if (nodes > maxNodes) break; }
  return sol && sol.length ? { slot: sol[0][0], r0: sol[0][1], c0: sol[0][2] } : null;
}
function bestMove() {
  let bm = null;
  for (const p of tray) { if (p.used) continue; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(bs, p.cells, r, c)) { const o = rplace(bs, p.cells, r, c), v = o.gems * 25 + o.ice * 10 + o.cracked.length * 4 + o.lines * 12 + r * 0.05; if (!bm || v > bm.v) bm = { slot: p.slot, r0: r, c0: c, v }; } }
  return bm;
}
function hintMove() {
  if (state !== 'play' || settle > 0 || botMove || !cur) return null;
  const early = !cur.daily && cur.n <= 2 && used === 0, wait = cur.n === 3 ? 4 : cur.n <= 2 && !cur.daily ? 0.6 : 7;
  if (idleT < (early ? 0.6 : wait)) return null;
  if (!hintCache || tray[hintCache.slot].used || !fits(bs, tray[hintCache.slot].cells, hintCache.r0, hintCache.c0)) { const h = solveFrom(60000) || bestMove(); hintCache = h; }
  return hintCache ? { p: tray[hintCache.slot], ...hintCache } : null;
}

// ------------------------------------------------------------------ coach (ring + hand + tip), copied from v1
const coach = (() => {
  const st = document.createElement('style');
  st.textContent = `.cx-ring{position:fixed;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:5px solid #fff;box-shadow:0 0 0 5px rgba(255,255,255,.35),0 0 26px 6px rgba(255,255,255,.9);pointer-events:none;z-index:6;animation:cxr .8s ease-in-out infinite}
@keyframes cxr{0%,100%{transform:scale(.72);opacity:1}50%{transform:scale(1.12);opacity:.75}}
.cx-hand{position:fixed;font-size:50px;line-height:1;pointer-events:none;z-index:7;margin:-6px 0 0 -16px;filter:drop-shadow(0 4px 2px rgba(0,0,0,.25))}
.cx-tip{position:fixed;left:50%;transform:translate(-50%,0);z-index:7;pointer-events:none;font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:16px;line-height:1.1;padding:5px 14px 2px;border-radius:22px;background:#fff;color:#2b3f8f;box-shadow:0 5px 0 rgba(0,0,0,.16);max-width:92vw;text-align:center;animation:cxi .35s cubic-bezier(.3,1.6,.5,1)}
@keyframes cxi{from{transform:translate(-50%,0) scale(.4);opacity:0}}
.cx-off{display:none!important}`;
  document.head.appendChild(st);
  const mk = (c, t = '') => { const d = document.createElement('div'); d.className = c + ' cx-off'; d.textContent = t; document.body.appendChild(d); return d; };
  const ring = mk('cx-ring'), hand = mk('cx-hand', '👆'), tip = mk('cx-tip'); let tipT = 0, tipTxt = '';
  const at = (e, x, y) => { e.style.left = x + 'px'; e.style.top = y + 'px'; e.classList.remove('cx-off'); };
  return {
    drag(x0, y0, x1, y1, t, sw = 70, sh = sw) { ring.style.width = sw + 'px'; ring.style.height = sh + 'px'; ring.style.margin = `${-sh / 2}px 0 0 ${-sw / 2}px`; ring.style.borderRadius = '22px'; const k = Math.min(1, (t % 1.7) / 1.1), e = k * k * (3 - 2 * k); at(ring, x1, y1); at(hand, lerp(x0, x1, e) + 8, lerp(y0, y1, e) + 14 - Math.sin(e * Math.PI) * 40); },
    off() { ring.classList.add('cx-off'); hand.classList.add('cx-off'); },
    say(text, topPct, ms = 0) { if (!text) return; if (text !== tipTxt) { tip.textContent = tipTxt = text; tip.classList.add('cx-off'); void tip.offsetWidth; } tip.style.top = `${topPct}%`; tip.classList.remove('cx-off'); tipT = ms ? performance.now() + ms : 0; },
    quiet(force) { if (force || !tipT || performance.now() > tipT) { tip.classList.add('cx-off'); tipTxt = ''; tipT = 0; } },
    get timed() { return tipT && performance.now() < tipT; },
  };
})();
let ran = false;
addEventListener('pointerdown', () => { if (!ran) { ran = true; WB.start(); } }, true);

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
function toWorld(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, hit); return hit.clone(); }
const LIFT = 2.4;
function pieceOrigin(p, wx, wy) { const [w, h] = dims(p.cells); const x0 = wx - (w - 1) / 2, y0 = wy + (h - 1) / 2; return [Math.round(BOARD_Y + 3.5 - y0), Math.round(x0 + 3.5)]; }
input({
  onDown: (e) => {
    if (state !== 'play' || botMove || settle > 0 || e.target.closest && e.target.closest('button,.ct-card,.ct-map')) return;
    const w = toWorld(e.clientX, e.clientY);
    if (w.y > TRAY_Y + 2.6) {
      const h = hintMove();
      if (h && cur.n <= 2 && !cur.daily && (!sel || sel.used)) { const [gw] = dims(h.p.cells), [hx, hy] = cellPos(h.r0, h.c0 + (gw - 1) / 2); if (Math.hypot(w.x - hx, w.y - hy) < (cur.n === 1 ? 99 : 2.6)) { sel = null; doPlace(h.p, h.r0, h.c0); return; } }
      if (sel && !sel.used) { const p = sel; sel = null; tryDrop({ p, x: w.x, y: w.y }); } return;
    }
    let bestI = -1, bd = 2.2; tray.forEach((p, i) => { if (p.used) return; const d = Math.abs(w.x - SLOT_X[i]); if (d < bd) { bd = d; bestI = i; } });
    if (bestI < 0) return;
    drag = { p: tray[bestI], x: SLOT_X[bestI], y: TRAY_Y, tx: SLOT_X[bestI], ty: TRAY_Y, s: TRAY_S, x0: e.clientX, y0: e.clientY, moved: false }; sfx.tap(); buzz(6);
  },
  onMove: (dx, dy, e) => { if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 12) return; drag.moved = true; const w = toWorld(e.clientX, e.clientY); drag.tx = w.x; drag.ty = w.y + LIFT; },
  onUp: () => {
    if (!drag) return; const d = drag; drag = null;
    if (!d.moved) { const h = hintMove(); if (h && h.p === d.p) { sel = null; botMove = { p: d.p, r0: h.r0, c0: h.c0, k: 0, x: SLOT_X[d.p.slot], y: TRAY_Y, s: TRAY_S }; return; } sel = sel === d.p ? null : d.p; return; }
    sel = null; tryDrop(d);
  },
});
function tryDrop(d) { const [r0, c0] = pieceOrigin(d.p, d.x, d.y); if (fits(bs, d.p.cells, r0, c0)) doPlace(d.p, r0, c0); else { tone(200, 0.08, 'sine', 0.08, 0.8); shake(0.45); buzz(25); } }

// ------------------------------------------------------------------ placing + clearing
const COMBO_WORDS = ['', 'GOOD!', 'GREAT!', 'EXCELLENT!', 'AMAZING!', 'UNBELIEVABLE!'];
const shake = (a = 1) => renderer.domElement.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-7 * a}px,${4 * a}px) rotate(${-0.8 * a}deg)` }, { transform: `translate(${6 * a}px,${-5 * a}px) rotate(${0.8 * a}deg)` }, { transform: `translate(${-3 * a}px,${2 * a}px)` }, { transform: 'translate(0,0)' }], { duration: 360 });
function doPlace(p, r0, c0) {
  p.used = true; idleT = 0; hintCache = null; used++; movesLeft--;
  const cr = r0 + dims(p.cells)[1] / 2, cc = c0 + dims(p.cells)[0] / 2;
  const o = rplace(bs, p.cells, r0, c0), before = vis.map(v => ({ ...v }));
  for (const [x, y] of p.cells) { const i = (r0 + y) * N + c0 + x; vis[i] = { ci: p.ci, pop: 1 }; }
  sfx.pick(p.cells.length); buzz(10);
  for (const [x, y] of p.cells) { const [bx, by] = cellPos(r0 + y, c0 + x); burst(scene, new THREE.Vector3(bx, by, 0.6), [pal()[p.ci], '#ffffff'], 3, { speed: 0.05, up: 0.04, size: 0.5, gravity: 0.006 }); }
  const bd = (i) => -Math.hypot(Math.floor(i / N) - cr, i % N - cc) * 0.035;
  const placedIdx = new Set(p.cells.map(([x, y]) => (r0 + y) * N + c0 + x));
  let iceBreak = 0, boom = o.blasts.length > 0;
  for (const [i, k] of o.cleared) {
    const [x, y] = cellPos(Math.floor(i / N), i % N), v = placedIdx.has(i) ? vis[i] : before[i], t0 = bd(i) - (boom && k !== 'B' ? 0.06 : 0);
    anims.push({ x, y, ci: v.ci, kind: k, t: t0, gem: k === 'G' });
    if (k === 'G') flyers.push({ x, y, t: t0 - 0.1, kind: 'gem' });
    if (k === 'i') { iceBreak++; flyers.push({ x, y, t: t0 - 0.1, kind: 'ice' }); }
  }
  for (const i of o.cracked) { vis[i].pop = 1; const [x, y] = cellPos(Math.floor(i / N), i % N); setTimeout(() => { burst(scene, new THREE.Vector3(x, y, 0.8), ['#e6faff', '#7fd4ff', '#ffffff'], 7, { speed: 0.11, up: 0.08, size: 0.45, gravity: 0.01 }); tone(1400 + Math.random() * 400, 0.06, 'triangle', 0.1, 0.7); }, 120); }
  bs = o.b; got = { gems: got.gems + o.gems, ice: got.ice + o.ice, lines: got.lines + o.lines };
  for (const i of o.blasts) { const [x, y] = cellPos(Math.floor(i / N), i % N); shock.push({ x, y, t: bd(i) }); }
  if (o.lines) {
    combo++; const lines = o.lines;
    const word = boom ? 'BOOM!' : o.passes > 1 ? 'CHAIN!' : lines > 1 ? COMBO_WORDS[Math.min(lines, 5)] : combo > 1 ? `COMBO ×${combo}` : COMBO_WORDS[1];
    ui.pop(word, ['#fff', '#ffe066', '#7dffb2', '#7ee8ff', '#ff9de2', '#ffd23f'][Math.min(lines + combo - 1 + (boom ? 2 : 0), 5)], 40 + Math.min(lines, 4) * 7 + (boom ? 10 : 0), 37);
    if (iceBreak) setTimeout(() => ui.pop('ICE BREAK!', '#bff3ff', 32, 45), 420);
    [0, 1, 2].slice(0, Math.min(3, lines + (boom ? 1 : 0))).forEach(i => setTimeout(() => tone(520 + i * 160 + combo * 40, 0.14, 'triangle', 0.14, 1.4), i * 90));
    if (combo >= 3) { ui.pop(combo >= 5 ? 'FEVER ×' + combo : 'ON FIRE ×' + combo, '#ffb02e', 30, 55); confetti(scene, new THREE.Vector3(0, BOARD_Y, 2), 14 + combo * 4); shake(Math.min(1.2, 0.3 + combo * 0.15)); [0, 1, 2, 3].forEach(i => setTimeout(() => tone(660 + i * 110 + combo * 70, 0.12, 'triangle', 0.13, 1.5), 140 + i * 70)); }
    ui.flash(0.18 + lines * 0.08 + Math.min(combo, 5) * 0.03); buzz([15, 20, 25]); settle = 0.45 + lines * 0.05 + (boom ? 0.25 : 0);
    if (boom || lines >= 3) { shake(boom ? 1.4 : 0.9); setTimeout(() => { tone(90, 0.3, 'sawtooth', 0.12, 0.4); }, 40); }
  } else { combo = 0; if (o.cracked.length) settle = Math.max(settle, 0.25); }
  refreshHud(true);
  if (tray.every(t => t.used) && movesLeft > 0 && !rdone(need, got)) dealTray();
  checkEnd();
}

function checkEnd() {
  if (rdone(need, got)) return win();
  const live = tray.filter(t => !t.used);
  if (movesLeft <= 0) return lose('moves');
  if (!live.some(t => anyFit(bs, t.cells))) return lose('space');
}

// ------------------------------------------------------------------ cards: win (stars, chest, tomorrow hook) / lose / map
const css = document.createElement('style');
css.textContent = `
.ct-goal{display:flex;gap:6px}.ct-goal i{width:2px;background:rgba(255,255,255,.25);border-radius:2px;margin:3px 2px}
.ct-goal .ice{width:18px;height:18px;border-radius:5px;background:linear-gradient(135deg,#fff,#aee6ff 50%,#59b9ee);box-shadow:0 0 10px rgba(160,230,255,.9);display:inline-block;align-self:center}
.ct-pips{position:fixed;left:50%;transform:translateX(-50%);top:calc(150px + env(safe-area-inset-top));display:flex;gap:5px;pointer-events:none;z-index:5;max-width:90vw;flex-wrap:wrap;justify-content:center}
.ct-pips b{width:12px;height:12px;border-radius:4px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.3);box-sizing:border-box}
.ct-pips b.on{background:#fff;border-color:#fff}.ct-pips b.low{background:#ffd23f;border-color:#ffd23f;animation:ctp .8s ease-in-out infinite}
@keyframes ctp{50%{transform:scale(1.35)}}
.ct-name{position:fixed;left:50%;transform:translateX(-50%);top:calc(86px + env(safe-area-inset-top));font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:15px;color:#fff;opacity:.9;pointer-events:none;z-index:5;white-space:nowrap;text-shadow:0 2px 0 rgba(30,10,100,.5)}
.ct-ib{position:fixed;top:calc(106px + env(safe-area-inset-top));width:42px;height:42px;border-radius:14px;border:2px solid rgba(255,255,255,.3);background:rgba(12,16,48,.55);color:#fff;font-size:22px;line-height:1;z-index:6;font-family:inherit}
.ct-ib.l{left:12px}.ct-ib.r{right:12px}
.ct-card{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:calc(120px + env(safe-area-inset-top)) 18px 30px;gap:10px;text-align:center;font-family:'Baloo 2',system-ui,sans-serif;color:#fff;background:rgba(20,10,80,.45);animation:ctc .3s ease-out}
@keyframes ctc{from{opacity:0}}
.ct-card h1{margin:0;font-size:46px;line-height:1;text-shadow:0 6px 0 #2a1785,0 10px 24px rgba(0,0,0,.25)}
.ct-card p{margin:0;font-weight:600;font-size:18px;opacity:.95}
.ct-stars{display:flex;gap:6px;font-size:58px;line-height:1;height:64px}.ct-stars s{text-decoration:none;filter:grayscale(1) brightness(.5);transform:scale(.4);opacity:.4;transition:all .35s cubic-bezier(.3,1.7,.5,1)}.ct-stars s.on{filter:none;transform:scale(1);opacity:1}
.ct-btn{font-family:inherit;font-weight:800;font-size:26px;padding:8px 34px 4px;border-radius:30px;border:0;background:#fff;color:#2b3f8f;box-shadow:0 6px 0 rgba(0,0,0,.22);margin-top:4px;min-width:200px}
.ct-btn.g{background:#7dffb2;color:#0b4a2a}.ct-btn.s{font-size:18px;background:rgba(255,255,255,.2);color:#fff;box-shadow:none;min-width:0;padding:6px 20px 2px}
.ct-row{display:flex;gap:10px}
.ct-chest{font-size:56px;animation:ctpp 1s ease-in-out infinite}@keyframes ctpp{50%{transform:scale(1.2) rotate(6deg)}}
.ct-bar{width:210px;height:12px;border-radius:8px;background:rgba(0,0,0,.28);overflow:hidden}.ct-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#ff9d3b)}
.ct-hook{margin-top:6px;padding:7px 16px 3px;border-radius:16px;background:rgba(0,0,0,.28);font-weight:600;font-size:15px}
.ct-map{position:fixed;inset:0;z-index:11;overflow-y:auto;background:linear-gradient(#3f2fcf,#2a1785 70%);font-family:'Baloo 2',system-ui,sans-serif;color:#fff;padding:calc(18px + env(safe-area-inset-top)) 14px 40px}
.ct-map h2{margin:0;font-size:30px;text-align:center}.ct-map .top{display:flex;justify-content:center;align-items:center;gap:12px;font-weight:800;font-size:18px;flex-wrap:wrap}
.ct-w{margin:14px auto 0;max-width:430px;border-radius:22px;padding:10px 12px 14px;background:rgba(255,255,255,.1)}.ct-w h3{margin:0 0 2px;font-size:20px}.ct-w small{opacity:.8;font-weight:600}
.ct-g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px}
.ct-n{aspect-ratio:1;border-radius:50%;border:3px solid rgba(255,255,255,.4);background:rgba(255,255,255,.14);color:#fff;font-family:inherit;font-weight:800;font-size:20px;line-height:1;padding:0;position:relative;display:flex;align-items:center;justify-content:center}
.ct-n.ok{background:var(--hue);border-color:#fff}.ct-n.now{animation:ctnn 1s ease-in-out infinite;box-shadow:0 0 0 4px rgba(255,255,255,.5)}.ct-n.lock{opacity:.4}.ct-n.boss{border-radius:16px}
@keyframes ctnn{50%{transform:scale(1.13)}}
.ct-n em{position:absolute;bottom:-9px;left:0;right:0;font-style:normal;font-size:11px;letter-spacing:-1px}
.ct-skins{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-top:8px}.ct-sk{width:40px;height:40px;border-radius:12px;border:3px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);display:flex;flex-wrap:wrap;overflow:hidden;font-size:18px;align-items:center;justify-content:center;padding:0;color:#fff}.ct-sk.on{border-color:#fff;box-shadow:0 0 0 3px #ffd23f}.ct-sk i{width:50%;height:50%}
`;
document.head.appendChild(css);
const cardEl = () => document.querySelector('.ct-card');
function hideCards() { document.querySelectorAll('.ct-card').forEach(x => x.remove()); }
const mkCard = html => { hideCards(); const d = document.createElement('div'); d.className = 'ct-card'; d.innerHTML = html; document.body.appendChild(d); return d; };
const hookLine = () => {
  const dd = S.get('dailyDone', 0) === day(), st = S.get('streak', 0);
  return dd ? `Tomorrow: a new Daily Dig${st > 1 ? ` · 🔥 ${st}-day streak` : ''}` : `🌟 Today's Daily Dig is waiting${st > 1 ? ` · 🔥 ${st}-day streak` : ''}`;
};

function win() {
  state = 'won'; F.level(true);
  const par = cur.daily || cur.endless ? 0 : PARS[cur.n - 1], st = par ? (used <= par ? 3 : movesLeft > 0 ? 2 : 1) : 3;
  let newStars = 0, firstClear = false, chest = null;
  if (cur.daily) { const wasDone = S.get('dailyDone', 0) === day(); if (!wasDone) { const y = new Date(); y.setDate(y.getDate() - 1); const yd = y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate(); S.set('streak', S.get('dailyDay', 0) === yd ? S.get('streak', 0) + 1 : 1); S.set('dailyDay', day()); S.set('dailyDone', day()); WB.submit(1); } }
  else if (cur.n <= 30) {
    const s = stars(), old = s[cur.n] || 0; firstClear = !old; newStars = Math.max(0, st - old); if (st > old) { s[cur.n] = st; S.set('stars', s); }
    S.set('reach', Math.max(reach(), cur.n + 1)); if (firstClear) WB.submit(1);
    const t0 = totalStars() - newStars, t1 = totalStars(); if (Math.floor(t1 / 10) > Math.floor(t0 / 10)) { const lock = SKINS.map((_, i) => i).filter(i => !skinOwned.includes(i)); if (lock.length) { const k = lock[Math.floor(Math.random() * lock.length)]; skinOwned = [...skinOwned, k]; S.set('skins', skinOwned); skinOn = k; S.set('skin', k); chest = k; } }
  } else { if (cur.n >= reach()) { S.set('reach', cur.n + 1); WB.submit(1); } }
  setTimeout(() => { sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(0, BOARD_Y + 2, 2), 60); confetti(scene, new THREE.Vector3(-3, BOARD_Y, 2), 30); confetti(scene, new THREE.Vector3(3, BOARD_Y, 2), 30); }, 350);
  setTimeout(() => { ui.flash(0.5); shake(0.8); }, 350);
  const nxt = cur.daily ? null : cur.n + 1;
  setTimeout(() => {
    const c = mkCard(`<p>${cur.daily ? 'DAILY DIG' : 'LEVEL ' + cur.n}</p><h1>${cur.daily ? 'DUG OUT!' : cur.boss ? 'BOSS DOWN!' : 'CLEARED!'}</h1>
      ${par ? `<div class="ct-stars"><s>⭐</s><s>⭐</s><s>⭐</s></div><p>${used} move${used > 1 ? 's' : ''}${par ? ` · par ${par}` : ''}</p>` : ''}
      ${chest !== null ? `<div class="ct-chest">🎁</div><p>Crystal chest! New blocks: <b>${SKINS[chest].name}</b></p>` : (cur.n <= 30 && !cur.daily ? `<div class="ct-bar"><i style="width:${(totalStars() % 10) * 10}%"></i></div><p style="font-size:14px">${10 - (totalStars() % 10)} ⭐ to the next crystal chest</p>` : '')}
      <div class="ct-row">${nxt ? `<button class="ct-btn g" data-a="next">Level ${nxt} ▶</button>` : `<button class="ct-btn g" data-a="map">Map</button>`}</div>
      <div class="ct-row"><button class="ct-btn s" data-a="again">${par && st < 3 ? '🔄 Try for ⭐⭐⭐' : '🔄 Replay'}</button><button class="ct-btn s" data-a="map">🗺️ Map</button></div>
      <div class="ct-hook">${hookLine()}</div>`);
    c.querySelectorAll('.ct-stars s').forEach((e, i) => setTimeout(() => { if (i < st) { e.classList.add('on'); sfx.pick(i + 3); tone(600 + i * 200, 0.2, 'triangle', 0.15, 1.3); buzz(12); } }, 350 + i * 330));
    c.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return; if (a === 'next') startLevel(nxt); else if (a === 'again') startLevel(cur.daily ? 0 : cur.n, { daily: cur.daily }); else openMap(); };
    if (chest !== null) setTimeout(() => ui.pop('✨ NEW SKIN ✨', '#ffe066', 30, 14), 900);
  }, 900);
}
function lose(why) {
  state = 'lost'; F.level(false, Math.min(1, ((Math.min(got.gems, need.gems) + Math.min(got.ice, need.ice)) / Math.max(1, need.gems + need.ice))));
  setTimeout(() => { sfx.fail(); buzz([60, 40, 60]); }, 300);
  for (let i = 0; i < 64; i++) if (bs[i] !== '.') vis[i].dead = (N - Math.floor(i / N)) * 0.05;
  const left = need.gems - Math.min(got.gems, need.gems) + need.ice - Math.min(got.ice, need.ice);
  const what = [need.gems > got.gems ? `${need.gems - got.gems} gem${need.gems - got.gems > 1 ? 's' : ''}` : '', need.ice > got.ice ? `${need.ice - got.ice} ice` : ''].filter(Boolean).join(' + ');
  const so = left <= 2 ? 'SO CLOSE!' : why === 'moves' ? 'OUT OF MOVES' : 'NO SPACE!';
  const line = why === 'moves' ? `${what} left. Look for a piece that clears more at once.` : `No piece fits. ${what} left.`;
  setTimeout(() => {
    const c = mkCard(`<h1>${so}</h1><p>${line}</p><div class="ct-row"><button class="ct-btn g" data-a="again">🔄 Try again</button></div><div class="ct-row"><button class="ct-btn s" data-a="map">🗺️ Map</button></div><div class="ct-hook">${hookLine()}</div>`);
    c.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (a === 'again') startLevel(cur.daily ? 0 : cur.n, { daily: cur.daily }); else if (a === 'map') openMap(); };
  }, 900);
}

let mapEl = null;
function closeMap() { if (mapEl) { mapEl.remove(); mapEl = null; } }
function openMap() {
  hideCards(); closeMap(); state = 'map'; coach.off(); coach.quiet(true);
  const s = stars(), rc = Math.min(reach(), 30), tot = totalStars(), dd = S.get('dailyDone', 0) === day(), st = S.get('streak', 0);
  mapEl = document.createElement('div'); mapEl.className = 'ct-map';
  let h = `<h2>CUBE TREK</h2><div class="top"><span>⭐ ${tot}</span><span>🎁 chest in ${10 - tot % 10} ⭐</span>${st > 1 ? `<span>🔥 ${st}</span>` : ''}</div>`;
  h += `<div style="text-align:center;margin-top:10px"><button class="ct-btn ${dd ? 's' : 'g'}" data-d="1">🌟 Daily Dig ${dd ? '(done)' : ''}</button></div>`;
  for (const w of WORLDS) {
    h += `<div class="ct-w" style="--hue:${w.hue}"><h3>${w.name} <small>${w.sub}</small></h3><div class="ct-g">`;
    for (let n = w.from; n <= w.to; n++) { const ok = n <= reach(), now = n === Math.min(reach(), 31) && n <= 30, got3 = s[n] || 0; h += `<button class="ct-n ${ok ? 'ok' : 'lock'} ${now ? 'now' : ''} ${LEVELS[n - 1].boss ? 'boss' : ''}" data-n="${n}">${ok ? (LEVELS[n - 1].boss ? '👑' : n) : '🔒'}<em>${got3 ? '⭐'.repeat(got3) : ''}</em></button>`; }
    h += `</div></div>`;
  }
  h += `<div class="ct-w" style="--hue:#7b5cff"><h3>Deep Dig <small>${reach() > 30 ? 'endless: level ' + (reach() - 30) : 'finish the Summit to open'}</small></h3><div style="text-align:center;margin-top:6px"><button class="ct-btn ${reach() > 30 ? 'g' : 's'}" data-n="${Math.max(31, reach())}">∞ Play</button></div></div>`;
  h += `<div class="ct-w"><h3>Block skins <small>${skinOwned.length}/${SKINS.length} · a chest every 10 ⭐</small></h3><div class="ct-skins">${SKINS.map((k, i) => skinOwned.includes(i) ? `<button class="ct-sk ${i === skinOn ? 'on' : ''}" data-k="${i}">${k.c.slice(0, 4).map(c => `<i style="background:${c}"></i>`).join('')}</button>` : `<button class="ct-sk" disabled>?</button>`).join('')}</div></div>`;
  mapEl.innerHTML = h; document.body.appendChild(mapEl);
  mapEl.onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; if (b.dataset.d) startLevel(0, { daily: true }); else if (b.dataset.k) { skinOn = +b.dataset.k; S.set('skin', skinOn); openMap(); } else if (b.dataset.n && +b.dataset.n <= Math.max(reach(), 1) && (+b.dataset.n <= 30 || reach() > 30)) startLevel(+b.dataset.n); };
  const now = mapEl.querySelector('.now'); if (now) now.scrollIntoView({ block: 'center' });
}

// ------------------------------------------------------------------ render
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), tmpC = new THREE.Color();
let ni = 0, ng = 0, nb = 0, nc = 0, ns = 0;
function addBlock(x, y, z, s, color, rot = 0, lighten = 0, sx = s, sy = s) {
  if (ni >= MAXI) return;
  e3.set(0, 0, rot); q.setFromEuler(e3);
  m4.compose(v3.set(x, y, z), q, sc.set(sx, sy, s)); blocks.setMatrixAt(ni, m4);
  col.set(color); if (lighten) col.lerp(tmpC.set('#ffffff'), lighten); blocks.setColorAt(ni, col);
  m4.compose(v3.set(x - 0.03 * sx, y + 0.03 * sy, z + 0.31 * s), q, sc.set(sx, sy, s)); faces.setMatrixAt(ni, m4);
  col.offsetHSL(0, -0.05, 0.1); faces.setColorAt(ni, col); ni++;
}
function addGem(x, y, z, s, t) { if (ng >= 90) return; e3.set(0.25, t * 2 + x, 0); q.setFromEuler(e3); m4.compose(v3.set(x, y, z), q, sc.set(s, s, s)); gems.setMatrixAt(ng++, m4); }
function addBomb(x, y, z, s, t) { if (nb >= 64) return; const k = s * (1 + 0.1 * Math.sin(t * 7 + x)); m4.compose(v3.set(x, y, z), q.identity(), sc.set(k, k, k)); bombs.setMatrixAt(nb++, m4); }
function addCrack(x, y, z, s) { for (const a of [0.6, -0.5]) { if (nc >= 130) return; e3.set(0, 0, a); q.setFromEuler(e3); m4.compose(v3.set(x, y, z), q, sc.set(s, s, 1)); cracks.setMatrixAt(nc++, m4); } }
function addShine(x, y, z, s) { if (ns >= 64) return; e3.set(0, 0, 0.7); q.setFromEuler(e3); m4.compose(v3.set(x - 0.2 * s, y + 0.2 * s, z), q, sc.set(s, s, 1)); shines.setMatrixAt(ns++, m4); }
const easeBack = t => { const c = 1.9; t = clamp(t, 0, 1); return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const KIND_COL = { I: '#cfeeff', i: '#8fcaf0', B: '#2b2d42' };
const cellColor = (i, k) => KIND_COL[k] || pal()[vis[i].ci % pal().length];

let prevKey = '', prevOut = null;
loop((dt, t) => {
  const sec = dt / 60; ni = ng = nb = nc = ns = 0; settle = Math.max(0, settle - sec);
  if (state === 'play' && !drag && !botMove) idleT += sec; else if (state !== 'play' || drag) idleT = 0;
  let prev = null;
  if (drag) {
    drag.x = lerp(drag.x, drag.tx, 0.45); drag.y = lerp(drag.y, drag.ty, 0.45); drag.s = lerp(drag.s, 1, 0.3);
    const [r0, c0] = pieceOrigin(drag.p, drag.x, drag.y);
    if (fits(bs, drag.p.cells, r0, c0)) { const key = bs + r0 + c0 + drag.p.slot + dealIdx; if (key !== prevKey) { prevKey = key; prevOut = rplace(bs, drag.p.cells, r0, c0); } prev = { r0, c0, set: new Set(prevOut.cleared.map(x => x[0])), crack: new Set(prevOut.cracked) }; }
  }
  if (botMove) {
    botMove.k = Math.min(1, botMove.k + sec * 3.2); const k = 1 - Math.pow(1 - botMove.k, 3);
    const p = botMove.p, [w, h] = dims(p.cells), [tx, ty] = cellPos(botMove.r0 + (h - 1) / 2, botMove.c0 + (w - 1) / 2);
    botMove.x = lerp(SLOT_X[p.slot], tx, k); botMove.y = lerp(TRAY_Y, ty, k) + Math.sin(k * Math.PI) * 1.2; botMove.s = lerp(TRAY_S, 1, k);
    if (botMove.k >= 1) { const b = botMove; botMove = null; doPlace(b.p, b.r0, b.c0); }
  }
  if (state !== 'map' || true) for (let i = 0; i < 64; i++) {
    const k = bs[i]; if (k === '.' || !vis[i]) continue; const b = vis[i], r = Math.floor(i / N), c = i % N, [x, y] = cellPos(r, c);
    if (b.pop !== 0) b.pop = b.pop < 0 ? Math.min(0, b.pop + sec) : Math.max(0, b.pop - sec * 4.5);
    let s = 1, z = 0, color = cellColor(i, k), light = k === 'I' ? 0.35 : 0;
    if (b.pop < 0) s = 0; else if (b.pop > 0) { const kk = 1 - b.pop; s = 1 + Math.sin(kk * Math.PI) * 0.18; z = Math.sin(kk * Math.PI) * 0.15; light = Math.max(light, b.pop * 0.5); }
    if (b.pop < 0 && b.pop > -0.25) s = easeBack((0.25 + b.pop) / 0.25);
    if (prev && prev.set.has(i)) { color = drag.p.ci !== undefined ? pal()[drag.p.ci] : color; light = 0.12 + 0.12 * Math.sin(t * 12); z = 0.08; }
    if (prev && prev.crack.has(i)) light = 0.3 + 0.2 * Math.sin(t * 14);
    if (b.dead !== undefined) { b.dead = Math.max(0, b.dead - sec); if (b.dead === 0) { color = '#7a7f9a'; light = 0; } }
    if (s <= 0.01) continue;
    addBlock(x, y, z, s, color, 0, light);
    if (k === 'G') addGem(x, y, 0.62 + z + Math.sin(t * 3 + x) * 0.05, s, t);
    else if (k === 'B') addBomb(x, y, 0.55 + z, s, t);
    else if (k === 'i') addCrack(x, y, 0.64 + z, s);
    if (k === 'I') addShine(x, y, 0.66 + z, s);
  }
  for (const a of anims) {
    a.t += sec; if (a.t < 0) { addBlock(a.x, a.y, 0, 1, a.kind === 'B' ? '#ffb347' : KIND_COL[a.kind] || pal()[a.ci % 7], 0, 0.1); if (a.gem) addGem(a.x, a.y, 0.62, 1, t); continue; }
    const colr = KIND_COL[a.kind] ? (a.kind === 'B' ? '#ff9d3b' : '#bfeaff') : pal()[a.ci % 7];
    if (!a.burst) { a.burst = true; burst(scene, new THREE.Vector3(a.x, a.y, 0.6), [colr, '#ffffff'], a.kind === 'B' ? 10 : a.kind === 'i' ? 7 : 4, { speed: a.kind === 'B' ? 0.16 : 0.09, up: 0.07, size: a.kind === 'B' ? 1.1 : 0.8, gravity: 0.008 }); if (Math.random() < 0.3) tone(700 + Math.random() * 500, 0.04, 'sine', 0.05, 1.5); }
    const k = a.t / 0.32; if (k >= 1) { a.done = true; continue; }
    addBlock(a.x, a.y, k * 1.2, (1 + k * 0.3) * (1 - k * k), colr, k * 2.4, Math.max(0, 0.9 - k * 1.5));
  }
  anims = anims.filter(a => !a.done);
  for (const w of shock) { w.t += sec; if (w.t < 0) continue; const k = w.t / 0.45; if (k >= 1) { w.done = true; continue; } if (!w.fx) { w.fx = true; burst(scene, new THREE.Vector3(w.x, w.y, 1), ['#fff3c4', '#ffb347', '#ff6a1a'], 14, { speed: 0.2, up: 0.1, size: 1.2, gravity: 0.004 }); }
    for (let a = 0; a < 10; a++) { const ang = a / 10 * 6.283 + k, rr = k * 2.4; e3.set(0, 0, 0); q.setFromEuler(e3); m4.compose(v3.set(w.x + Math.cos(ang) * rr, w.y + Math.sin(ang) * rr, 1), q.identity(), sc.set(0.26 * (1 - k), 0.26 * (1 - k), 0.26 * (1 - k))); if (nb < 64) bombs.setMatrixAt(nb++, m4); } }
  shock = shock.filter(w => !w.done);
  for (const f of flyers) {
    f.t += sec; if (f.t < 0) continue; const k = Math.min(1, f.t / 0.55), e = k * k * (3 - 2 * k);
    if (!f.sx) { f.sx = f.x; f.sy = f.y; }
    const gx = f.kind === 'ice' ? 1.6 : -1.6;
    if (f.kind === 'gem') addGem(lerp(f.sx, gx, e) + Math.sin(k * Math.PI) * (f.sx > 0 ? 1.5 : -1.5), lerp(f.sy, 8.6, e), 1 + Math.sin(k * Math.PI) * 2, 1 + Math.sin(k * Math.PI) * 0.6, t * 4);
    else { const s2 = 0.5 * (1 - e * 0.5); addBlock(lerp(f.sx, gx, e), lerp(f.sy, 8.6, e), 1.5, s2, '#cfeeff', k * 6, 0.4); }
    if (k >= 1) { f.done = true; sfx.coin(); refreshHud(true); burst(scene, new THREE.Vector3(gx, 8.6, 1), ['#bff6ff', '#4fd8ff', '#fff'], 10, { speed: 0.08, up: 0.05, size: 0.5 }); }
  }
  flyers = flyers.filter(f => !f.done);
  for (const p of tray || []) {
    if (p.used) continue; const [w, h] = dims(p.cells);
    p.pop = Math.min(1, p.pop + sec * 3.5);
    const holder = drag && drag.p === p ? drag : botMove && botMove.p === p ? botMove : null, up = sel === p && !holder;
    const s = holder ? holder.s : TRAY_S * easeBack(Math.max(0, p.pop)) * (up ? 1.18 : 1), cxp = holder ? holder.x : SLOT_X[p.slot], cyp = holder ? holder.y : TRAY_Y + (up ? 0.45 + Math.sin(t * 6) * 0.08 : Math.sin(t * 2 + p.slot) * 0.05);
    const z = holder || up ? 1.4 : 0, fitsSomewhere = state !== 'play' || anyFit(bs, p.cells);
    for (const [x, y] of p.cells) addBlock(cxp + (x - (w - 1) / 2) * s, cyp - (y - (h - 1) / 2) * s, z, s * 0.98, fitsSomewhere ? pal()[p.ci % 7] : '#6c7090', 0, holder ? 0.08 : 0);
  }
  ghost.count = 0; nearGlow(t);
  const hm = !prev && !drag && !botMove ? hintMove() : null;
  if (hm) { const gs = 0.9 + 0.08 * Math.sin(t * 7); for (const [x, y] of hm.p.cells) { const [gx, gy] = cellPos(hm.r0 + y, hm.c0 + x); m4.compose(v3.set(gx, gy, 0.1), q.identity(), sc.set(gs, gs, 0.6)); ghost.setMatrixAt(ghost.count++, m4); } ghost.instanceMatrix.needsUpdate = true; ghost.material.color.set(pal()[hm.p.ci % 7]).lerp(tmpC.set('#fff'), 0.12 + 0.2 * Math.sin(t * 7)); ghost.material.opacity = 0.86 + 0.14 * Math.sin(t * 7); }
  else ghost.material.opacity = 0.5;
  coachTick(hm, t);
  if (prev) { for (const [x, y] of drag.p.cells) { const [gx, gy] = cellPos(prev.r0 + y, prev.c0 + x); m4.compose(v3.set(gx, gy, -0.05), q.identity(), sc.set(0.96, 0.96, 0.5)); ghost.setMatrixAt(ghost.count++, m4); } ghost.instanceMatrix.needsUpdate = true; ghost.material.color.set(pal()[drag.p.ci % 7]).lerp(tmpC.set('#fff'), 0.3); }
  blocks.count = faces.count = ni; gems.count = ng; bombs.count = nb; cracks.count = nc; shines.count = ns;
  for (const m of [blocks, faces, gems, bombs, cracks, shines]) m.instanceMatrix.needsUpdate = true;
  if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true; if (faces.instanceColor) faces.instanceColor.needsUpdate = true;
});
const toScreen = (x, y) => { const v = new THREE.Vector3(x, y, 0.3).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
function nearGlow(t) {
  if (state !== 'play') return; const todo = new Set();
  for (let r = 0; r < N; r++) { let e = []; for (let c = 0; c < N; c++) if (bs[r * N + c] === '.') e.push(r * N + c); if (e.length && e.length <= 2) e.forEach(i => todo.add(i)); }
  for (let c = 0; c < N; c++) { let e = []; for (let r = 0; r < N; r++) if (bs[r * N + c] === '.') e.push(r * N + c); if (e.length && e.length <= 2) e.forEach(i => todo.add(i)); }
  const gs = 0.55 + 0.1 * Math.sin(t * 5); let n = 0;
  for (const i of todo) { if (n++ > 20) break; const [gx, gy] = cellPos(Math.floor(i / N), i % N); m4.compose(v3.set(gx, gy, -0.08), q.identity(), sc.set(gs, gs, 0.3)); ghost.setMatrixAt(ghost.count++, m4); }
  ghost.instanceMatrix.needsUpdate = true; ghost.material.color.set('#ffe066'); ghost.material.opacity = 0.35 + 0.15 * Math.sin(t * 5);
}
function coachTick(hm, t) {
  if (!hm || state !== 'play') { coach.off(); if (state !== 'play') coach.quiet(true); else if (!coach.timed) coach.quiet(); return; }
  const [w, h] = dims(hm.p.cells), [tx, ty] = toScreen(...cellPos(hm.r0 + (h - 1) / 2, hm.c0 + (w - 1) / 2)), [sx, sy] = toScreen(SLOT_X[hm.p.slot], TRAY_Y);
  const cpx = Math.abs(toScreen(...cellPos(0, 1))[0] - toScreen(...cellPos(0, 0))[0]);
  coach.drag(sx, sy, tx, ty, t, w * cpx + 26, h * cpx + 26);
  if (!coach.timed) coach.quiet();
}

// ------------------------------------------------------------------ start: new players go straight into level 1 (no menu); returning players land on the map
const Q = new URLSearchParams(location.search);
if (Q.get('daily') === '1') startLevel(0, { daily: true });
else if (Q.get('level')) startLevel(+Q.get('level'));
else if (reach() > 1 && !Q.get('nomap')) openMap();
else startLevel(1);

window.__game = {
  get state() { return state; }, get level() { return cur ? cur.n : 0; }, get movesLeft() { return movesLeft; }, get used() { return used; }, get bs() { return bs; },
  load(n) { startLevel(n); }, openMap, SKINS, reach: () => reach(), stars,
  solveStep() { return solveFrom(400000); },
  play(slot, r, c) { const p = tray[slot]; if (state !== 'play' || botMove || drag || settle > 0 || !p || p.used || !fits(bs, p.cells, r, c)) return false; botMove = { p, r0: r, c0: c, k: 0, x: SLOT_X[slot], y: TRAY_Y, s: TRAY_S }; return true; },
  cellXY(r, c) { return toScreen(...cellPos(r, c)); }, trayXY(i) { return toScreen(SLOT_X[i], TRAY_Y); },
  bot() { if (state !== 'play' || botMove || drag || settle > 0) return; const m = solveFrom(400000) || bestMove(); if (m) { const p = tray[m.slot]; botMove = { p, r0: m.r0, c0: m.c0, k: 0, x: SLOT_X[m.slot], y: TRAY_Y, s: TRAY_S }; sfx.tap(); } },
};

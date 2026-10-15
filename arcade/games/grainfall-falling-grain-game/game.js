// Grainfall — coloured pieces fall into a glass case and crumble into grains the moment they land.
// The grains slide and settle (a cellular automaton on a texture). A connected band of one colour that touches
// both side walls sparkles away. Endless; the run ends when grains pile up to the top.
import { THREE, createStage, createUI, loop, glossy, mat, rounded, burst, confetti, sfx, tone, note, buzz, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
const B = board({ game: 'grainfall', label: 'Points', limits: { maxRun: 200000, maxPerSec: 400 } });   // world board (RULES.md part C)

const NAME = 'Grainfall: Falling Grain Game';
const S = createStage({ fov: 30, shadowSize: 8 });
const { scene, camera, sun, hemi } = S;
sun.position.set(2, 8, 14); sun.intensity = 1.3; hemi.intensity = 1.25;
const ui = createUI({ title: 'GRAIN<br>FALL', hint: 'Drag to move · tap to turn · swipe down to drop', hand: '👆', progress: false });
const D = daily('grainfall', ui, { name: NAME });
ui.els.win.querySelector('p').innerHTML = 'SCORE <span data-l></span>'; ui.els.win.querySelector('h1').textContent = 'NEW BEST!';
const save = store('grainfall');
const F = flow('grainfall', { par: 2500, warmup: 600 });
let best = save.get('best', 0), score = 0, state = 'ready';

const css = document.createElement('style'); css.textContent = `
body{--bg1:#ffd9ec;--bg2:#d9e4ff}
.hc-score{top:calc(14px + env(safe-area-inset-top));font-size:42px;color:#fff;-webkit-text-stroke:6px rgba(70,50,130,.35);paint-order:stroke fill}
.hc-sub{top:calc(58px + env(safe-area-inset-top));color:#5b4a9e;text-shadow:none;font-weight:800;font-size:14px}
.hc-card{background:rgba(60,40,120,.22)} .hc-card.dim{background:rgba(40,25,80,.45)}
.hc-pop{-webkit-text-stroke:6px rgba(70,50,130,.55);paint-order:stroke fill}
.gf-next{position:fixed;top:calc(14px + env(safe-area-inset-top));right:12px;z-index:6;background:rgba(255,255,255,.82);border-radius:16px;padding:3px 8px 8px;display:flex;flex-direction:column;align-items:center;color:#5b4a9e;font:800 12px 'Baloo 2',system-ui;box-shadow:0 4px 0 rgba(70,50,130,.15);pointer-events:none}
.gf-next canvas{width:52px;height:40px;image-rendering:pixelated}
`; document.head.appendChild(css);
const nextEl = document.createElement('div'); nextEl.className = 'gf-next'; nextEl.innerHTML = 'NEXT<canvas width="26" height="20"></canvas>'; document.body.appendChild(nextEl);
const nctx = nextEl.querySelector('canvas').getContext('2d');

// ---------------------------------------------------------------- sand grid
const C = 9, COLS = 8, GW = C * COLS, GH = 128;           // grains; a piece cell is C×C grains
const PAL = [[255, 93, 108], [255, 196, 58], [61, 139, 255], [63, 207, 110], [166, 107, 255]];
const grid = new Uint8Array(GW * GH);      // 0 empty, 1..5 colour
const shade = new Uint8Array(GW * GH);     // per-grain brightness variation
const flashT = new Float32Array(GW * GH);  // >0 = sparkling, about to vanish
const px = new Uint8Array(GW * GH * 4);
const tex = new THREE.DataTexture(px, GW, GH, THREE.RGBAFormat); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
const BGC = [40, 36, 74], TOPL = 20;

// ---------------------------------------------------------------- 3D case
const BW = 6, BH = BW * GH / GW;
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d - 1.8 * r, r);
const caseG = new THREE.Group(); scene.add(caseG);
{
  const frameMat = glossy('#ffffff', { roughness: 0.25 });
  const back = new THREE.Mesh(rbox(BW + 0.7, BH + 0.7, 0.5, 0.22), frameMat); back.position.z = -0.32; back.receiveShadow = true; back.castShadow = true; caseG.add(back);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(rbox(0.36, BH + 0.7, 0.9, 0.16), glossy('#ffffff', { roughness: 0.25 })); w.position.set(sx * (BW / 2 + 0.17), 0, 0.05); w.castShadow = true; caseG.add(w); }
  const fl = new THREE.Mesh(rbox(BW + 0.7, 0.36, 0.9, 0.16), frameMat); fl.position.set(0, -BH / 2 - 0.17, 0.05); caseG.add(fl);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: tex })); sand.position.z = 0.0; caseG.add(sand);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.2 })); glass.position.z = 0.45; caseG.add(glass);
  const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.1, BH * 0.9), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06 })); shine.position.set(-BW / 2 + 0.3, 0, 0.46); caseG.add(shine);
  const topLine = new THREE.Mesh(new THREE.PlaneGeometry(BW, 0.03), new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.45 })); topLine.position.set(0, BH / 2 - (TOPL / GH) * BH, 0.01); caseG.add(topLine);
}
function fit() {
  const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max((BW + 1.1) / (2 * tn * camera.aspect * 0.97), (BH + 1.1) / (2 * tn * 0.84));
  camera.position.set(0, -0.35, d); camera.lookAt(0, -0.35, 0);
}
addEventListener('resize', fit); fit();
const g2w = (gx, gy) => new THREE.Vector3(-BW / 2 + (gx + 0.5) / GW * BW, -BH / 2 + (gy + 0.5) / GH * BH, 0.2);

// ---------------------------------------------------------------- pieces
const SHAPES = [
  [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]],
];
function rotCells(cells, r) {
  let c = cells.map(([x, y]) => [x, y]);
  for (let k = 0; k < r; k++) c = c.map(([x, y]) => [y, -x]);
  const mx = Math.min(...c.map((p) => p[0])), my = Math.min(...c.map((p) => p[1]));
  return c.map(([x, y]) => [x - mx, y - my]);
}
let botPlan = null, settleWait = 0, fallAcc = 0, landPuff = 0, piece = null, nextP = null, R = Math.random, nColors = 4, fast = false, recorded = false, beatenShown = false, combo = 0, comboT = 0, spawnGrace = 0;
function makePiece() { return { s: Math.floor(R() * SHAPES.length), r: 0, col: 1 + Math.floor(R() * nColors), x: 0, y: 0, seed: Math.floor(R() * 1e6) }; }
const cellsOf = (p) => rotCells(SHAPES[p.s], p.r);
function fits(p, x, y) {   // x,y = bottom-left grain of the piece's bounding box; y grows upward
  for (const [cx, cy] of cellsOf(p)) {
    const gx0 = Math.round(x) + cx * C, gy0 = Math.floor(y) + cy * C;
    if (gx0 < 0 || gx0 + C > GW || gy0 < 0) return false;
    for (let yy = gy0; yy < gy0 + C; yy++) { if (yy >= GH) continue; const row = yy * GW; for (let xx = gx0; xx < gx0 + C; xx++) if (grid[row + xx]) return false; }
  }
  return true;
}
const pw = (p) => (Math.max(...cellsOf(p).map((c) => c[0])) + 1) * C, ph = (p) => (Math.max(...cellsOf(p).map((c) => c[1])) + 1) * C;
function spawn() {
  piece = nextP || makePiece(); nextP = makePiece(); drawNext();
  piece.x = Math.round((GW - pw(piece)) / 2 / C) * C; piece.y = GH - ph(piece); fast = false; spawnGrace = 0.15; botPlan = null;
  if (!fits(piece, piece.x, piece.y)) gameOver();
}
function land() {
  const rr = rng(piece.seed + 1);
  for (const [cx, cy] of cellsOf(piece)) {
    const gx0 = Math.round(piece.x) + cx * C, gy0 = Math.floor(piece.y) + cy * C;
    for (let yy = gy0; yy < gy0 + C; yy++) for (let xx = gx0; xx < gx0 + C; xx++) {
      if (yy >= GH) continue; const i = yy * GW + xx; grid[i] = piece.col; shade[i] = 200 + Math.floor(rr() * 55); flashT[i] = 0;
    }
  }
  const p = g2w(piece.x + pw(piece) / 2, piece.y);
  burst(scene, p, [`rgb(${PAL[piece.col - 1].join(',')})`, '#ffffff'], 10, { speed: 0.05, up: 0.05, size: 0.35, gravity: 0.004 });
  tone(180 + piece.col * 30, 0.12, 'triangle', 0.1, 0.5); buzz(12);
  score += 4; ui.score(score); landPuff = 1;
  piece = null; settleWait = 0.12;
}

// ---------------------------------------------------------------- cellular automaton
let flip = false, moved = 0;
function stepSand() {
  moved = 0; flip = !flip;
  for (let y = 1; y < GH; y++) {
    const row = y * GW, below = row - GW;
    for (let k = 0; k < GW; k++) {
      const x = flip ? k : GW - 1 - k, i = row + x, c = grid[i];
      if (!c || flashT[i] > 0) continue;
      if (!grid[below + x]) { grid[below + x] = c; shade[below + x] = shade[i]; grid[i] = 0; moved++; continue; }
      const dir = ((x + y + (flip ? 1 : 0)) & 1) ? 1 : -1;
      for (const d of [dir, -dir]) {
        const nx = x + d; if (nx < 0 || nx >= GW) continue;
        if (!grid[below + nx] && !grid[row + nx] && (y < 2 || !grid[below - GW + nx]) /* slopes settle at ~2:1 */) { grid[below + nx] = c; shade[below + nx] = shade[i]; grid[i] = 0; moved++; break; }
      }
    }
  }
  return moved;
}

// ---------------------------------------------------------------- clearing: a colour band wall-to-wall
const seen = new Int32Array(GW * GH); let stamp = 1;
const tmpG = new Uint8Array(GW * GH), N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const qbuf = new Int32Array(GW * GH);
function findBand() {
  stamp++;
  for (let y = 0; y < GH; y++) {
    const s0 = y * GW, c = grid[s0]; if (!c || seen[s0] === stamp || flashT[s0] > 0) continue;
    let qh = 0, qt = 0, hitR = false; qbuf[qt++] = s0; seen[s0] = stamp;
    while (qh < qt) {
      const i = qbuf[qh++], x = i % GW, yy = (i - x) / GW; if (x === GW - 1) hitR = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = yy + dy; if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) continue;
        const j = ny * GW + nx; if (seen[j] === stamp || grid[j] !== c || flashT[j] > 0) continue; seen[j] = stamp; qbuf[qt++] = j;
      }
    }
    if (hitR) return { c, cells: qbuf.slice(0, qt) };
  }
  return null;
}
let clearing = 0, clearCells = null;
function startClear(b) {
  clearCells = b.cells; clearing = 0.55;
  for (const i of b.cells) { const x = i % GW; flashT[i] = 0.0001 + x / GW * 0.3; }
  combo = comboT > 0 ? combo + 1 : 1; comboT = 2.5;
  const pts = b.cells.length * Math.min(4, combo); score += pts; ui.score(score);
  ui.pop(combo > 1 ? `COMBO x${combo}! +${pts}` : `+${pts}`, '#fff', combo > 1 ? 38 : 34, 26);
  [72, 76, 79, 84, 88].forEach((m, k) => setTimeout(() => note(m + combo * 2, 0.28, 0.13), k * 55)); buzz([15, 25, 15]); ui.flash(0.25);
  let sy = 0; for (const i of b.cells) sy += Math.floor(i / GW); sy /= b.cells.length;
  for (let k = 0; k < 6; k++) burst(scene, g2w(GW * (k + 0.5) / 6, sy), [`rgb(${PAL[b.c - 1].join(',')})`, '#ffffff', '#fff6b0'], 8, { speed: 0.06, up: 0.07, size: 0.4, shape: 'sphere' });
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 34); confetti(scene, new THREE.Vector3(0, 0, 1), 60); }
}
function finishClear() { for (const i of clearCells) { grid[i] = 0; flashT[i] = 0; } clearCells = null; tone(900, 0.15, 'sine', 0.06, 1.5); }

// ---------------------------------------------------------------- render the texture
function paint(t) {
  px.fill(0);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, o = i * 4, c = grid[i];
    if (!c) { const v = 1 - y / GH * 0.25; px[o] = BGC[0] * v; px[o + 1] = BGC[1] * v; px[o + 2] = BGC[2] * v; px[o + 3] = 255; continue; }
    const p = PAL[c - 1], s = shade[i] / 255;
    let r = p[0] * s, g = p[1] * s, b = p[2] * s;
    if (flashT[i] > 0) { const ft = flashT[i], k = 0.5 + 0.5 * Math.sin(t * 40 + x * 0.7); const w = clamp((0.55 - clearing) * 3 - ft * 2.2 + 0.3, 0, 1) * k; r = lerp(r, 255, w); g = lerp(g, 255, w); b = lerp(b, 245, w); }
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
  if (piece) {
    // ghost: where it would land
    let gy = Math.floor(piece.y); while (gy > 0 && fits(piece, piece.x, gy - 1)) gy--;
    const p = PAL[piece.col - 1], rr = rng(piece.seed + 1);
    for (const [cx, cy] of cellsOf(piece)) {
      const gx0 = Math.round(piece.x) + cx * C;
      for (let yy = 0; yy < C; yy++) for (let xx = 0; xx < C; xx++) {
        const X = gx0 + xx; let Y = gy + cy * C + yy;
        if (Y < GH && (xx === 0 || yy === 0 || xx === C - 1 || yy === C - 1)) { const o = (Y * GW + X) * 4; px[o] = lerp(px[o], p[0], 0.35); px[o + 1] = lerp(px[o + 1], p[1], 0.35); px[o + 2] = lerp(px[o + 2], p[2], 0.35); }
        Y = Math.floor(piece.y) + cy * C + yy; const s = (200 + Math.floor(rr() * 55)) / 255;
        if (Y >= GH) continue; const o = (Y * GW + X) * 4;
        const edge = yy === C - 1 || xx === 0 ? 1.18 : yy === 0 || xx === C - 1 ? 0.78 : 1;
        px[o] = Math.min(255, p[0] * s * edge); px[o + 1] = Math.min(255, p[1] * s * edge); px[o + 2] = Math.min(255, p[2] * s * edge);
      }
    }
  }
  tex.needsUpdate = true;
}
function drawNext() {
  nctx.clearRect(0, 0, 26, 20); if (!nextP) return; const cs = rotCells(SHAPES[nextP.s], 0), p = PAL[nextP.col - 1];
  const w = (Math.max(...cs.map((c) => c[0])) + 1) * 5, h = (Math.max(...cs.map((c) => c[1])) + 1) * 5, ox = (26 - w) / 2, oy = (20 - h) / 2;
  for (const [x, y] of cs) { nctx.fillStyle = `rgb(${p.join(',')})`; nctx.fillRect(ox + x * 5, 20 - oy - (y + 1) * 5, 5, 5); nctx.fillStyle = 'rgba(255,255,255,.35)'; nctx.fillRect(ox + x * 5, 20 - oy - (y + 1) * 5, 5, 1); }
}

// ---------------------------------------------------------------- input
let drag = null;
const gpp = () => { const v1 = g2w(0, 0).project(camera), v2 = g2w(GW, 0).project(camera); return GW / ((v2.x - v1.x) / 2 * innerWidth); };
addEventListener('pointerdown', (e) => { if (state !== 'play') return; drag = { x0: e.clientX, y0: e.clientY, t: performance.now(), px0: piece ? piece.x : 0, moved: false, acc: 0 }; });
addEventListener('pointermove', (e) => {
  if (!drag || !piece || state !== 'play') return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (Math.abs(dx) > 6) drag.moved = true;
  if (drag.moved) {
    const target = Math.round(drag.px0 + dx * gpp() * 1.15);
    const dir = Math.sign(target - piece.x);
    while (piece.x !== target && fits(piece, piece.x + dir, piece.y)) piece.x += dir;
    piece.x = clamp(piece.x, 0, GW - pw(piece));
  }
});
addEventListener('pointerup', (e) => {
  if (!drag || state !== 'play') { drag = null; return; }
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0, dt = performance.now() - drag.t;
  if (dy > 50 && dy > Math.abs(dx) * 1.3 && dt < 450) { fast = true; tone(300, 0.08, 'sine', 0.08, 0.5); }
  else if (!drag.moved && Math.hypot(dx, dy) < 12) rotate();
  drag = null;
});
function rotate() {
  if (!piece) return; const nr = (piece.r + 1) % 4, t = { ...piece, r: nr };
  for (const kick of [0, -C, C, -2 * C, 2 * C]) { const nx = clamp(piece.x + kick, 0, GW - pw(t)); if (fits(t, nx, piece.y)) { piece.r = nr; piece.x = nx; sfx.tap(); pieceSquash = 1; return; } }
}
let pieceSquash = 0;

// ---------------------------------------------------------------- run lifecycle
function reset() {
  grid.fill(0); flashT.fill(0); score = 0; ui.score(0); combo = 0; comboT = 0; clearing = 0; clearCells = null; recorded = false; beatenShown = false;
  R = D.seed ? rng(D.seed) : Math.random; nColors = 4; nextP = null; spawn();
  ui.sub(best ? `BEST ${best}` : '');
}
function gameOver() {
  if (state !== 'play') return; state = 'lost'; piece = null;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best; if (nb) { best = score; save.set('best', best); }
  sfx.fail(); buzz([40, 60, 40]); ui.flash(0.4);
  if (nb && score > 0) { state = 'won'; D.won(score); ui.win(score, 'Your best run yet'); }
  else ui.lose('TOPPED OUT!', `${score} points` + (best ? ` · best ${best}` : ''));
}
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; return; } reset(); state = 'play'; });
reset(); ui.start();

// ---------------------------------------------------------------- bot: pick a column + turn that lands next to its own colour
function bot() {
  if (state !== 'play' || !piece) return;
  if (!botPlan) {
    let bestS = -1e9;
    for (let r = 0; r < 4; r++) {
      const t = { ...piece, r }, w = pw(t);
      for (let x = 0; x <= GW - w; x += 2) {
        let y = Math.floor(piece.y); if (!fits(t, x, y)) continue; while (y > 0 && fits(t, x, y - 1)) y--;
        // put the piece in a scratch grid and measure how far its colour band now reaches across
        tmpG.set(grid); const col = piece.col, cells = [];
        for (const [cx, cy] of cellsOf(t)) { const gx0 = x + cx * C, gy0 = y + cy * C; for (let yy = gy0; yy < Math.min(GH, gy0 + C); yy++) for (let xx = gx0; xx < gx0 + C; xx++) { tmpG[yy * GW + xx] = col; cells.push(yy * GW + xx); } }
        stamp++; let qh = 0, qt = 0, minX = GW, maxX = 0;
        for (const i of cells) { if (seen[i] !== stamp) { seen[i] = stamp; qbuf[qt++] = i; } }
        while (qh < qt) { const i = qbuf[qh++], xx = i % GW, yy = (i - xx) / GW; if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
          for (const [dx, dy] of N8) { const nx = xx + dx, ny = yy + dy; if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) continue; const j = ny * GW + nx; if (seen[j] === stamp || tmpG[j] !== col) continue; seen[j] = stamp; qbuf[qt++] = j; } }
        let s = (maxX - minX) / GW * 60 + (minX === 0 ? 8 : 0) + (maxX === GW - 1 ? 8 : 0) + (minX === 0 && maxX === GW - 1 ? 500 : 0) - y * 0.5 + Math.random() * 3;
        if (s > bestS) { bestS = s; botPlan = { r, x }; }
      }
    }
    if (!botPlan) botPlan = { r: piece.r, x: piece.x };
  }
  if (piece.r !== botPlan.r) { rotate(); if (piece.r !== botPlan.r) { botPlan.r = piece.r; } return; }
  if (piece.x !== botPlan.x) { const d = Math.sign(botPlan.x - piece.x); for (let k = 0; k < 6 && piece.x !== botPlan.x; k++) { if (fits(piece, piece.x + d, piece.y)) piece.x += d; else { botPlan.x = piece.x; break; } } return; }
  fast = true;
}

// ---------------------------------------------------------------- loop
let time = 0;
loop((dt) => {
  const h = dt / 60; time += h;
  if (state === 'play') {
    comboT = Math.max(0, comboT - h);
    nColors = score > 2500 / F.k(score) ? 5 : 4;
    // sand physics: a few passes per frame
    for (let k = 0; k < 3; k++) stepSand();
    if (clearing > 0) {
      clearing -= h; for (const i of clearCells) if (flashT[i] > 0) flashT[i] += h;
      if (clearing <= 0) finishClear();
    } else { const b = findBand(); if (b) startClear(b); }
    // piece
    if (!piece) { settleWait -= h; if (settleWait <= 0 && clearing <= 0) { spawn(); } }
    else {
      spawnGrace = Math.max(0, spawnGrace - h);
      const speed = fast ? 150 : (10 + Math.min(26, score / 300)) * F.k(score);
      fallAcc += speed * h;
      while (fallAcc >= 1 && piece) {
        fallAcc -= 1;
        if (fits(piece, piece.x, piece.y - 1)) piece.y -= 1; else if (spawnGrace <= 0) { land(); fallAcc = 0; }
        else break;
      }
    }
    // topped out: settled sand above the line
    if (!piece || piece.y < GH - 30) { const row = (GH - TOPL) * GW; for (let x = 0; x < GW; x++) if (grid[row + x] && moved === 0 && flashT[row + x] === 0) { gameOver(); break; } }
  }
  pieceSquash = Math.max(0, pieceSquash - h * 5); landPuff = Math.max(0, landPuff - h * 4);
  caseG.position.y = -landPuff * 0.04; caseG.rotation.z = Math.sin(time * 0.7) * 0.004;
  paint(time);
});

window.__game = { get state() { return state; }, get level() { return 1; }, get score() { return score; }, bot, dbg: () => { const b = findBand(); return { band: b && b.cells.length, left: [...Array(GH)].map((_, y) => grid[y * GW]).join(""), right: [...Array(GH)].map((_, y) => grid[y * GW + GW - 1]).join("") }; } };

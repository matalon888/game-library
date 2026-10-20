// Peakpatch cards: every face, back and badge is painted in code onto one 2048² atlas; each card is a thin rounded
// slab (extruded, bevelled) whose UVs point at its face cell (front), its island back (back) and a gilt edge cell.
// One shared MeshPhysicalMaterial (clearcoat) for every card → cheap draw calls, glossy premium look.
import { THREE } from './kit/hc.js';

export const CW = 1, CH = 1.4;                          // card size in card units (aspect 1 : 1.4)
const AW = 2048, CELL_W = 160, CELL_H = 224, COLS = 12; // atlas grid (12 × 9 cells)
export const SUITS = ['♠', '♥', '♦', '♣'], RED = [false, true, true, false];
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const CELL = { face: (r, s) => s * 13 + r - 1, wild: 52, back: i => 53 + (i % 12), edge: 65, lock: n => 66 + Math.min(9, Math.max(1, n)) - 1, gold: 75 };

// island card-back palettes (deep, then light) + accent, matching each diorama
export const BACKS = [
  ['#c23a4a', '#ff7a7a', '#ffe2a8'], ['#d0517f', '#ffa3c6', '#ffe3f0'], ['#2e4f8f', '#6f9cf0', '#ffe0a0'], ['#1f6fb2', '#5cc4ff', '#ffffff'],
  ['#b4503a', '#ff9a6e', '#fff0c8'], ['#2f6a4f', '#62b98a', '#f4fff0'], ['#0f8f8f', '#4fe0d0', '#fff6c8'], ['#a0402a', '#ef8d4a', '#ffe1a0'],
  ['#5f8f3a', '#a8dc6a', '#fff3c8'], ['#c7862d', '#ffd27a', '#fff6dc'], ['#8a3d26', '#e2733a', '#ffe0b0'], ['#c23a6a', '#ff8ab0', '#fff0c0'],
];

function cellXY(i) { return [(i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H]; }
function rr(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }

// suit glyphs as vector paths centred on (0,0), size ≈ 1
function suitPath(x, s) {
  x.beginPath();
  if (s === 1) {            // heart
    x.moveTo(0, 0.42); x.bezierCurveTo(-0.62, 0.0, -0.55, -0.5, -0.26, -0.48); x.bezierCurveTo(-0.08, -0.47, 0, -0.32, 0, -0.24);
    x.bezierCurveTo(0, -0.32, 0.08, -0.47, 0.26, -0.48); x.bezierCurveTo(0.55, -0.5, 0.62, 0.0, 0, 0.42);
  } else if (s === 2) {     // diamond
    x.moveTo(0, -0.5); x.quadraticCurveTo(0.12, -0.2, 0.38, 0); x.quadraticCurveTo(0.12, 0.2, 0, 0.5); x.quadraticCurveTo(-0.12, 0.2, -0.38, 0); x.quadraticCurveTo(-0.12, -0.2, 0, -0.5);
  } else if (s === 0) {     // spade
    x.moveTo(0, -0.5); x.bezierCurveTo(0.1, -0.32, 0.55, -0.12, 0.48, 0.12); x.bezierCurveTo(0.43, 0.32, 0.18, 0.34, 0.05, 0.2);
    x.quadraticCurveTo(0.08, 0.38, 0.2, 0.5); x.lineTo(-0.2, 0.5); x.quadraticCurveTo(-0.08, 0.38, -0.05, 0.2);
    x.bezierCurveTo(-0.18, 0.34, -0.43, 0.32, -0.48, 0.12); x.bezierCurveTo(-0.55, -0.12, -0.1, -0.32, 0, -0.5);
  } else {                  // club
    x.arc(0, -0.24, 0.2, 0, Math.PI * 2); x.moveTo(-0.2, 0.08); x.arc(-0.22, 0.08, 0.2, 0, Math.PI * 2); x.moveTo(0.42, 0.08); x.arc(0.22, 0.08, 0.2, 0, Math.PI * 2);
    x.moveTo(-0.06, 0.05); x.lineTo(0.06, 0.05); x.quadraticCurveTo(0.08, 0.38, 0.2, 0.5); x.lineTo(-0.2, 0.5); x.quadraticCurveTo(-0.08, 0.38, -0.06, 0.05);
  }
  x.closePath();
}
function drawSuit(x, s, cx, cy, size, shade = true) {
  x.save(); x.translate(cx, cy); x.scale(size, size);
  const red = RED[s];
  const g = x.createLinearGradient(0, -0.5, 0, 0.5);
  if (red) { g.addColorStop(0, '#ff6b7f'); g.addColorStop(1, '#c81d3c'); } else { g.addColorStop(0, '#4b4f6e'); g.addColorStop(1, '#16182a'); }
  if (shade) { x.shadowColor = 'rgba(60,20,40,.25)'; x.shadowBlur = 0.04 * size; x.shadowOffsetY = 0.03 * size; }
  suitPath(x, s); x.fillStyle = g; x.fill();
  x.shadowColor = 'transparent';
  // glossy highlight
  x.save(); suitPath(x, s); x.clip(); x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.ellipse(-0.12, -0.26, 0.2, 0.12, -0.5, 0, Math.PI * 2); x.fill(); x.restore();
  x.restore();
}
function crown(x, cx, cy, w, col) {
  x.save(); x.translate(cx, cy); x.scale(w, w);
  x.beginPath(); x.moveTo(-0.5, 0.3); x.lineTo(-0.5, -0.15); x.lineTo(-0.25, 0.08); x.lineTo(0, -0.32); x.lineTo(0.25, 0.08); x.lineTo(0.5, -0.15); x.lineTo(0.5, 0.3); x.closePath();
  const g = x.createLinearGradient(0, -0.3, 0, 0.3); g.addColorStop(0, '#ffe58a'); g.addColorStop(1, '#d99a1e'); x.fillStyle = g; x.fill();
  x.lineWidth = 0.05; x.strokeStyle = '#a8690a'; x.stroke();
  for (const [px, py] of [[-0.5, -0.17], [0, -0.34], [0.5, -0.17]]) { x.beginPath(); x.arc(px, py, 0.08, 0, 7); x.fillStyle = col; x.fill(); }
  x.fillStyle = col; x.fillRect(-0.36, 0.14, 0.72, 0.08);
  x.restore();
}

function drawFace(x, r, s) {
  const red = RED[s], ink = red ? '#d3203f' : '#22243a';
  // index: big rank top-left + suit, readable even when the lower half is covered
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = `800 ${r === 10 ? 58 : 66}px "Baloo 2", system-ui, sans-serif`;
  const ix = r === 10 ? 44 : 38;
  x.lineWidth = 6; x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineJoin = 'round'; x.strokeText(RANKS[r], ix, 66);
  x.fillStyle = ink; x.fillText(RANKS[r], ix, 66);
  drawSuit(x, s, r === 10 ? 116 : 104, 42, 44);
  // centre art
  if (r >= 11) {
    const g = x.createLinearGradient(0, 96, 0, 210); g.addColorStop(0, red ? '#ffe4e8' : '#e7e8f6'); g.addColorStop(1, red ? '#ffc9d2' : '#cfd2ec');
    rr(x, 22, 92, 116, 116, 18); x.fillStyle = g; x.fill(); x.lineWidth = 3; x.strokeStyle = '#d9a63a'; x.stroke();
    crown(x, 80, 122, r === 13 ? 70 : r === 12 ? 58 : 46, red ? '#ff4d6d' : '#5b6cff');
    x.font = '800 54px "Baloo 2", system-ui, sans-serif'; x.fillStyle = ink; x.fillText(RANKS[r], 80, 196);
    drawSuit(x, s, 118, 180, 22, false); drawSuit(x, s, 42, 180, 22, false);
  } else if (r === 1) {
    drawSuit(x, s, 80, 150, 104);
  } else {
    drawSuit(x, s, 80, 152, 82);
  }
}

function drawCellBase(x, X, Y, kind = 'face') {
  x.save(); x.translate(X, Y);
  // the whole cell is the card face (UVs map card corners to cell corners): paint edge-to-edge, rounded mask is geometric
  const g = x.createLinearGradient(0, 0, CELL_W, CELL_H);
  g.addColorStop(0, '#fffdf7'); g.addColorStop(0.55, '#fff6e6'); g.addColorStop(1, '#f6e7cf');
  x.fillStyle = g; x.fillRect(0, 0, CELL_W, CELL_H);
  // inner gilt line
  rr(x, 7, 7, CELL_W - 14, CELL_H - 14, 14); x.lineWidth = 2.5; x.strokeStyle = 'rgba(214,168,74,.75)'; x.stroke();
  return x;
}

function drawBack(x, i) {
  const [deep, light, acc] = BACKS[i];
  const g = x.createLinearGradient(0, 0, CELL_W, CELL_H); g.addColorStop(0, light); g.addColorStop(0.5, deep); g.addColorStop(1, deep);
  x.fillStyle = g; x.fillRect(0, 0, CELL_W, CELL_H);
  // lattice
  x.save(); rr(x, 14, 14, CELL_W - 28, CELL_H - 28, 12); x.clip();
  x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 2;
  for (let k = -CELL_H; k < CELL_W + CELL_H; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + CELL_H, CELL_H); x.stroke(); x.beginPath(); x.moveTo(k, CELL_H); x.lineTo(k + CELL_H, 0); x.stroke(); }
  const rg = x.createRadialGradient(CELL_W / 2, CELL_H * 0.45, 4, CELL_W / 2, CELL_H * 0.5, CELL_H * 0.6); rg.addColorStop(0, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(0,0,0,.18)');
  x.fillStyle = rg; x.fillRect(0, 0, CELL_W, CELL_H);
  x.restore();
  // gold frames
  rr(x, 8, 8, CELL_W - 16, CELL_H - 16, 14); x.lineWidth = 5; x.strokeStyle = '#f1c75b'; x.stroke();
  rr(x, 15, 15, CELL_W - 30, CELL_H - 30, 10); x.lineWidth = 1.5; x.strokeStyle = 'rgba(255,236,170,.8)'; x.stroke();
  // medallion: sun over three peaks
  const cx = CELL_W / 2, cy = CELL_H / 2;
  x.beginPath(); x.arc(cx, cy, 40, 0, 7); const mg = x.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, 42); mg.addColorStop(0, '#fff8dc'); mg.addColorStop(1, acc);
  x.fillStyle = mg; x.fill(); x.lineWidth = 4; x.strokeStyle = '#e8b23e'; x.stroke();
  x.beginPath(); x.arc(cx + 13, cy - 14, 9, 0, 7); x.fillStyle = '#ffb02e'; x.fill();
  x.beginPath(); x.moveTo(cx - 34, cy + 22); x.lineTo(cx - 18, cy - 2); x.lineTo(cx - 8, cy + 8); x.lineTo(cx + 4, cy - 14); x.lineTo(cx + 18, cy + 6); x.lineTo(cx + 24, cy); x.lineTo(cx + 34, cy + 22); x.closePath();
  const pg = x.createLinearGradient(0, cy - 14, 0, cy + 22); pg.addColorStop(0, light); pg.addColorStop(1, deep); x.fillStyle = pg; x.fill();
  x.beginPath(); x.moveTo(cx + 4, cy - 14); x.lineTo(cx + 9, cy - 7); x.lineTo(cx, cy - 6); x.closePath(); x.fillStyle = '#fff'; x.fill();
  // corner pips
  for (const [px, py] of [[26, 26], [CELL_W - 26, 26], [26, CELL_H - 26], [CELL_W - 26, CELL_H - 26]]) { x.beginPath(); x.arc(px, py, 5, 0, 7); x.fillStyle = '#f1c75b'; x.fill(); }
}

function drawWild(x) {
  const g = x.createLinearGradient(0, 0, CELL_W, CELL_H);
  ['#ff7eb3', '#ffb86b', '#ffe66b', '#7be08a', '#6bc8ff', '#b48bff'].forEach((c, i) => g.addColorStop(i / 5, c));
  x.fillStyle = g; x.fillRect(0, 0, CELL_W, CELL_H);
  x.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 26; i++) { x.beginPath(); x.arc((i * 53) % CELL_W, (i * 97) % CELL_H, 2 + (i % 4), 0, 7); x.fill(); }
  rr(x, 8, 8, CELL_W - 16, CELL_H - 16, 14); x.lineWidth = 5; x.strokeStyle = '#fff6c8'; x.stroke();
  // star
  const cx = CELL_W / 2, cy = 104; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 22 : 52; x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  x.closePath(); const sg = x.createLinearGradient(0, cy - 50, 0, cy + 50); sg.addColorStop(0, '#fffbe0'); sg.addColorStop(1, '#ffc21a');
  x.fillStyle = sg; x.shadowColor = 'rgba(160,60,120,.45)'; x.shadowBlur = 10; x.shadowOffsetY = 4; x.fill(); x.shadowColor = 'transparent';
  x.lineWidth = 4; x.strokeStyle = '#fff'; x.stroke();
  x.font = '800 40px "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.lineWidth = 7; x.strokeStyle = '#a02f7a'; x.strokeText('WILD', cx, 196); x.fillStyle = '#fff'; x.fillText('WILD', cx, 196);
  x.font = '800 34px "Baloo 2", system-ui, sans-serif'; x.textAlign = 'left'; x.lineWidth = 6; x.strokeText('★', 18, 50); x.fillText('★', 18, 50);
}

function drawLock(x, n) {
  x.clearRect(0, 0, CELL_W, CELL_H);
  // vines + a gold padlock with a counter (centre of the cell; drawn on a transparent overlay quad)
  x.strokeStyle = '#3f9a4a'; x.lineWidth = 9; x.lineCap = 'round';
  x.beginPath(); x.moveTo(0, 40); x.bezierCurveTo(50, 70, 110, 30, 160, 70); x.stroke();
  x.beginPath(); x.moveTo(0, 170); x.bezierCurveTo(60, 140, 100, 200, 160, 160); x.stroke();
  x.fillStyle = '#5cc265';
  for (const [lx, ly, a] of [[30, 52, 0.6], [92, 52, -0.4], [134, 60, 0.9], [36, 160, -0.6], [100, 168, 0.5], [140, 156, -0.8]]) { x.save(); x.translate(lx, ly); x.rotate(a); x.beginPath(); x.ellipse(0, 0, 13, 7, 0, 0, 7); x.fill(); x.restore(); }
  const cx = 80, cy = 120;
  x.lineWidth = 12; x.strokeStyle = '#c9cfe0'; x.beginPath(); x.arc(cx, cy - 16, 24, Math.PI, 0); x.stroke();
  x.lineWidth = 4; x.strokeStyle = '#8a91aa'; x.beginPath(); x.arc(cx, cy - 16, 30, Math.PI, 0); x.stroke();
  const g = x.createLinearGradient(0, cy - 20, 0, cy + 40); g.addColorStop(0, '#ffe58a'); g.addColorStop(1, '#e09a1c');
  rr(x, cx - 40, cy - 18, 80, 62, 14); x.fillStyle = g; x.shadowColor = 'rgba(80,40,0,.4)'; x.shadowBlur = 8; x.shadowOffsetY = 4; x.fill(); x.shadowColor = 'transparent';
  x.lineWidth = 3; x.strokeStyle = '#a8690a'; x.stroke();
  x.font = '800 50px "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = '#7a4a00'; x.strokeText(String(n), cx, cy + 15); x.fillStyle = '#fff'; x.fillText(String(n), cx, cy + 15);
}

let atlasTex = null;
export function buildAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = AW; const x = c.getContext('2d');
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) { const [X, Y] = cellXY(CELL.face(r, s)); drawCellBase(x, X, Y); drawFace(x, r, s); x.restore(); }
  { const [X, Y] = cellXY(CELL.wild); x.save(); x.translate(X, Y); drawWild(x); x.restore(); }
  for (let i = 0; i < 12; i++) { const [X, Y] = cellXY(CELL.back(i)); x.save(); x.translate(X, Y); drawBack(x, i); x.restore(); }
  { const [X, Y] = cellXY(CELL.edge); const g = x.createLinearGradient(X, 0, X + CELL_W, 0); g.addColorStop(0, '#f6e2b0'); g.addColorStop(0.5, '#fffaf0'); g.addColorStop(1, '#e8c77a'); x.fillStyle = g; x.fillRect(X, Y, CELL_W, CELL_H); }
  for (let n = 1; n <= 9; n++) { const [X, Y] = cellXY(CELL.lock(n)); x.save(); x.translate(X, Y); drawLock(x, n); x.restore(); }
  { const [X, Y] = cellXY(CELL.gold); x.save(); x.translate(X, Y); const g = x.createRadialGradient(80, 112, 10, 80, 112, 110); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.5, 'rgba(255,200,80,.55)'); g.addColorStop(1, 'rgba(255,190,60,0)'); x.fillStyle = g; x.fillRect(0, 0, CELL_W, CELL_H); x.restore(); }
  atlasTex = new THREE.CanvasTexture(c); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8; atlasTex.generateMipmaps = true; atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  return atlasTex;
}
export const cellUV = i => { const [X, Y] = cellXY(i); return [X / AW, 1 - (Y + CELL_H) / AW, CELL_W / AW, CELL_H / AW]; };   // u0, v0, du, dv

// ---------------------------------------------------------------- geometry
const T = 0.035, BEV = 0.012, RAD = 0.11;
let base = null;
function baseGeo() {
  if (base) return base;
  const w = CW / 2 - BEV, h = CH / 2 - BEV, r = RAD, s = new THREE.Shape();
  s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 5 });
  g.translate(0, 0, -T / 2);
  // classify vertices: 0 front cap, 1 back cap, 2 edge
  const pos = g.attributes.position, n = pos.count, tag = new Uint8Array(n);
  const capEnd = g.groups[0].count;   // ExtrudeGeometry: group 0 = caps, group 1 = sides
  for (let i = 0; i < n; i++) tag[i] = i < capEnd ? (pos.getZ(i) > 0 ? 0 : 1) : 2;
  g.clearGroups();
  base = { g, tag };
  return base;
}
/** a fresh card geometry with UVs for (front cell, back cell) */
export function cardGeo(front, back) {
  const { g, tag } = baseGeo(), geo = g.clone(); geo.userData.tag = tag;
  setCells(geo, front, back); return geo;
}
export function setCells(geo, front, back) {
  const tag = geo.userData.tag, pos = geo.attributes.position, uv = geo.attributes.uv, F = cellUV(front), B = cellUV(back), E = cellUV(CELL.edge);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) / CW + 0.5, py = pos.getY(i) / CH + 0.5;
    if (tag[i] === 0) uv.setXY(i, F[0] + px * F[2], F[1] + py * F[3]);
    else if (tag[i] === 1) uv.setXY(i, B[0] + (1 - px) * B[2], B[1] + py * B[3]);
    else uv.setXY(i, E[0] + (0.2 + 0.6 * px) * E[2], E[1] + 0.5 * E[3]);
  }
  uv.needsUpdate = true; geo.userData.front = front; geo.userData.back = back;
}
/** quad geometry showing one atlas cell (lock badges, glows) */
export function quadGeo(cell, w = CW, h = CH) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, C = cellUV(cell);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, C[0] + uv.getX(i) * C[2], C[1] + uv.getY(i) * C[3]);
  return g;
}
export function setQuadCell(g, cell) { const uv = g.attributes.uv, C = cellUV(cell), b = [[0, 1], [1, 1], [0, 0], [1, 0]]; for (let i = 0; i < 4; i++) uv.setXY(i, C[0] + b[i][0] * C[2], C[1] + b[i][1] * C[3]); uv.needsUpdate = true; }

export function cardMaterial(tex) {
  return new THREE.MeshPhysicalMaterial({ map: tex, color: '#b9b4ac', roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.22, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.08, envMapIntensity: 0.25 });
}

// soft drop shadow texture (for the instanced shadow quads)
export function shadowTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 88; const x = c.getContext('2d');
  x.shadowColor = 'rgba(40,20,50,.6)'; x.shadowBlur = 9; x.shadowOffsetX = 1000; x.fillStyle = '#000'; rr(x, 12 - 1000, 12, 40, 64, 8); x.fill();
  const t = new THREE.CanvasTexture(c); return t;
}

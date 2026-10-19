// scenes.js — procedural cozy scenes painted in code (room, garden, beach, camp). World is 1000 × 1500 units.
// Each painter fills the bake canvas and returns the spots where findable things can lie. Our own code, MIT.
import { OUT, drawItem } from './items.js';
export const WW = 1000, HH = 1500;

const L = 3;   // outline width in world units
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const fs = (g, c, lw = L) => { g.fillStyle = c; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); } };
const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); };
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
const grad = (g, y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let R = n >> 16, G = (n >> 8) & 255, B = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); R = Math.round((t - R) * p + R); G = Math.round((t - G) * p + G); B = Math.round((t - B) * p + B); return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1); };
const BOOKC = ['#e76f51', '#2a9d8f', '#e9c46a', '#8d6cab', '#457b9d', '#f4a261', '#c8553d', '#6a994e', '#d1495b', '#3d5a80'];
const FLOWC = ['#ff6b8b', '#ffd23f', '#ffffff', '#b388ff', '#ff9e5e', '#7ad3ff'];

function shadowEll(g, x, y, rx, ry, a = 0.16) { g.save(); g.globalAlpha = a; ell(g, x, y, rx, ry); g.fillStyle = '#2b1d16'; g.fill(); g.restore(); }
function plant(g, r, x, y, s = 1, pot = '#d9825b') {
  shadowEll(g, x, y + 4, 55 * s, 12 * s);
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.33 + (r() - 0.5) * 0.2, len = (80 + r() * 50) * s; ell(g, x + Math.cos(a) * len * 0.5, y - 60 * s + Math.sin(a) * len * 0.5, len * 0.5, 13 * s, a); fs(g, i % 2 ? '#4f9d69' : '#6cbf7f', 2.5); }
  g.beginPath(); g.moveTo(x - 42 * s, y - 62 * s); g.lineTo(x + 42 * s, y - 62 * s); g.lineTo(x + 32 * s, y); g.lineTo(x - 32 * s, y); g.closePath(); fs(g, pot); rr(g, x - 47 * s, y - 70 * s, 94 * s, 16 * s, 5 * s); fs(g, shade(pot, -0.12));
}
function grassTuft(g, x, y, s, c) { g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(x + i * 3 * s, y); g.quadraticCurveTo(x + i * 5 * s, y - 10 * s, x + i * 7 * s, y - (14 + (2 - Math.abs(i)) * 5) * s); } g.strokeStyle = c; g.lineWidth = 2.6 * s; g.lineCap = 'round'; g.stroke(); }
function flower(g, x, y, s, c) { for (let i = 0; i < 5; i++) { const a = i * 1.2566; circ(g, x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s, 5 * s); fs(g, c, 1.6); } circ(g, x, y, 4 * s); fs(g, '#ffb703', 1.4); }
function stone(g, x, y, rx, ry, c = '#b9b2a6') { ell(g, x, y, rx, ry); fs(g, c, 2.5); ell(g, x - rx * 0.25, y - ry * 0.35, rx * 0.4, ry * 0.25); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill(); }
function bush(g, r, x, y, w, c) { for (let i = 0; i < 7; i++) { circ(g, x + (i - 3) * w / 7 + (r() - 0.5) * 8, y - r() * w * 0.18, w * (0.16 + r() * 0.08)); fs(g, i % 2 ? c : shade(c, 0.12), 2.5); } }
function pine(g, x, y, h, c) { for (let i = 0; i < 4; i++) { const w = h * (0.42 - i * 0.07), yy = y - i * h * 0.2; g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - h * 0.42); g.lineTo(x + w, yy); g.closePath(); fs(g, i % 2 ? c : shade(c, 0.08), 2.5); } g.beginPath(); g.rect(x - h * 0.04, y, h * 0.08, h * 0.12); fs(g, '#6b4a35', 2.5); }

// ================================================================ ROOM
function room(g, r) {
  const pal = pick(r, [{ wall: ['#f6dcc1', '#efc9a8'], paper: '#e2a97e', wain: '#9fc9b5', floor: '#c98f5f', rug: '#d65f5f' }, { wall: ['#dbe8f4', '#c6d9ea'], paper: '#9fb8d6', wain: '#e8b07a', floor: '#b98458', rug: '#4f86c6' }, { wall: ['#f3e1f0', '#e5cbe2'], paper: '#c99bc4', wain: '#a7c79a', floor: '#c48d63', rug: '#e09a3e' }]);
  g.fillStyle = grad(g, 0, 900, pal.wall); g.fillRect(0, 0, WW, 900);
  g.globalAlpha = 0.35; g.fillStyle = pal.paper; for (let y = 30; y < 780; y += 56) for (let x = (y / 56 % 2) * 28 + 14; x < WW; x += 56) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.fill(); } g.globalAlpha = 1;
  g.fillStyle = pal.wain; g.fillRect(0, 770, WW, 135); g.strokeStyle = OUT; g.lineWidth = L; g.strokeRect(-5, 770, WW + 10, 135);
  for (let x = 20; x < WW; x += 120) { rr(g, x, 790, 100, 95, 6); g.fillStyle = shade(pal.wain, 0.12); g.fill(); g.lineWidth = 2; g.stroke(); }
  // floor planks
  g.fillStyle = grad(g, 900, HH, [pal.floor, shade(pal.floor, -0.12)]); g.fillRect(0, 900, WW, 600);
  g.strokeStyle = 'rgba(60,35,20,.35)'; g.lineWidth = 2; for (let y = 900; y < HH; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(WW, y); g.stroke(); const off = r() * 200; for (let x = off; x < WW; x += 230) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 46); g.stroke(); } }
  g.fillStyle = 'rgba(40,20,10,.25)'; g.fillRect(0, 900, WW, 10);
  // window with curtains
  const wx = 60 + r() * 40, wy = 120, ww = 320, wh = 330, night = r() < 0.4;
  rr(g, wx - 16, wy - 16, ww + 32, wh + 32, 10); fs(g, '#fff6ea'); g.fillStyle = grad(g, wy, wy + wh, night ? ['#2c3463', '#7c6a9c'] : ['#8fd3f4', '#dff4ff']); g.fillRect(wx, wy, ww, wh);
  if (night) { for (let i = 0; i < 25; i++) { circ(g, wx + r() * ww, wy + r() * wh * 0.7, 1.5 + r() * 1.5); g.fillStyle = '#fff'; g.fill(); } circ(g, wx + ww * 0.7, wy + 80, 32); fs(g, '#fff4c9', 2); }
  else { circ(g, wx + ww * 0.72, wy + 80, 36); fs(g, '#fff3b0', 0); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; ell(g, wx + 60 + i * 90, wy + 150 + i * 30, 46, 14); g.fill(); } }
  g.fillStyle = night ? '#3e4a7a' : '#7cc47a'; g.beginPath(); g.moveTo(wx, wy + wh); for (let x = 0; x <= ww; x += 20) g.lineTo(wx + x, wy + wh - 40 - Math.sin(x * 0.03) * 25); g.lineTo(wx + ww, wy + wh); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke(); g.lineWidth = L; g.strokeRect(wx, wy, ww, wh);
  const cc = pick(r, ['#e76f51', '#6d9dc5', '#e9c46a', '#b07bac']);
  for (const side of [0, 1]) { const x0 = side ? wx + ww - 30 : wx - 40; g.beginPath(); g.moveTo(x0, wy - 30); g.lineTo(x0 + 70, wy - 30); g.quadraticCurveTo(x0 + (side ? 30 : 40), wy + wh * 0.5, x0 + 70 * side + (side ? -10 : 10), wy + wh + 40); g.lineTo(x0 + (side ? 70 : 0), wy + wh + 40); g.closePath(); fs(g, cc); g.strokeStyle = shade(cc, -0.2); g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0 + k * 17, wy - 25); g.lineTo(x0 + k * 17 + (side ? -8 : 8), wy + wh + 30); g.stroke(); } }
  rr(g, wx - 70, wy - 42, ww + 140, 14, 7); fs(g, '#8a5a3c');
  rr(g, wx - 30, wy + wh + 12, ww + 60, 22, 5); fs(g, '#fff6ea');   // sill
  plant(g, r, wx + 50, wy + wh + 12, 0.42, '#5aa9e6'); plant(g, r, wx + ww - 40, wy + wh + 12, 0.36, '#f4a261');
  // shelves with books, jars, pots
  const spots = [];
  const sx0 = 480, sx1 = 950;
  for (const sy of [260, 470]) {
    let x = sx0 + 10;
    while (x < sx1 - 30) {
      const t = r();
      if (t < 0.55) { const n = 2 + Math.floor(r() * 5); for (let i = 0; i < n && x < sx1 - 30; i++) { const w = 18 + r() * 16, h = 70 + r() * 55, lean = r() < 0.12; g.save(); if (lean) { g.translate(x, sy); g.rotate(-0.2); g.translate(-x, -sy); } rr(g, x, sy - h, w, h, 3); fs(g, pick(r, BOOKC), 2.5); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 3, sy - h + 12, w - 6, 4); g.fillRect(x + 3, sy - 20, w - 6, 4); g.restore(); x += w + 1; } x += 20 + r() * 30; }
      else if (t < 0.75) { const w = 44 + r() * 14, h = 54 + r() * 30, c = pick(r, ['#bde0fe', '#ffe5b4', '#d8f3dc', '#ffd6e0']); rr(g, x, sy - h, w, h, 10); fs(g, c, 2.5); rr(g, x - 3, sy - h - 10, w + 6, 14, 4); fs(g, pick(r, ['#e76f51', '#2a9d8f', '#8d6cab']), 2.5); for (let i = 0; i < 4; i++) { circ(g, x + 10 + r() * (w - 20), sy - 12 - r() * (h - 25), 5 + r() * 5); g.fillStyle = pick(r, ['#f4a261', '#e63946', '#6a994e', '#8d5a3a']); g.fill(); } x += w + 26; }
      else { plant(g, r, x + 26, sy, 0.38, pick(r, ['#d9825b', '#f1faee', '#a3c4bc'])); x += 70; }
    }
    rr(g, sx0 - 14, sy, sx1 - sx0 + 28, 20, 4); fs(g, '#a06b45'); for (const bx of [sx0 + 30, sx1 - 40]) { g.beginPath(); g.moveTo(bx, sy + 20); g.lineTo(bx + 14, sy + 20); g.lineTo(bx + 14, sy + 50); g.closePath(); fs(g, '#7a4f33', 2); }
    spots.push({ x: sx0, y: sy - 34, w: sx1 - sx0, h: 26, wt: 0.8 });
  }
  // framed pictures
  for (const [px, py, pw, ph] of [[530, 560, 120, 90], [700, 540, 90, 120], [830, 570, 110, 80]]) { rr(g, px, py, pw, ph, 4); fs(g, '#c8955f'); g.fillStyle = grad(g, py + 10, py + ph - 10, ['#ffe8c2', '#a8dadc']); g.fillRect(px + 10, py + 10, pw - 20, ph - 20); g.fillStyle = '#6a994e'; g.beginPath(); g.moveTo(px + 10, py + ph - 10); g.lineTo(px + pw * 0.4, py + ph * 0.45); g.lineTo(px + pw - 10, py + ph - 10); g.fill(); }
  // sofa
  const so = { x: 500, y: 760, w: 470 }, sc = pick(r, ['#e07a5f', '#81b29a', '#6d9dc5', '#c08497']);
  shadowEll(g, so.x + so.w / 2, 985, so.w * 0.55, 28);
  rr(g, so.x + 30, so.y, so.w - 60, 140, 30); fs(g, shade(sc, -0.08)); rr(g, so.x + 40, so.y + 120, so.w - 80, 85, 18); fs(g, sc);
  for (const ax of [so.x, so.x + so.w - 70]) { rr(g, ax, so.y + 70, 70, 140, 26); fs(g, shade(sc, -0.15)); }
  for (const [cx2, cc2] of [[so.x + 100, '#ffd166'], [so.x + so.w - 170, '#fff3e0']]) { rr(g, cx2, so.y + 50, 80, 75, 22); fs(g, cc2); }
  g.beginPath(); g.moveTo(so.x + 200, so.y + 30); g.lineTo(so.x + 290, so.y + 26); g.lineTo(so.x + 300, so.y + 200); g.lineTo(so.x + 210, so.y + 205); g.closePath(); fs(g, '#9b5de5'); g.strokeStyle = '#fff'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(so.x + 205, so.y + 60 + k * 38); g.lineTo(so.x + 295, so.y + 56 + k * 38); g.stroke(); }
  for (const lx of [so.x + 60, so.x + so.w - 70]) { g.beginPath(); g.rect(lx, so.y + 205, 12, 25); fs(g, '#5a3a28', 2); }
  spots.push({ x: so.x + 60, y: so.y + 135, w: so.w - 120, h: 40, wt: 0.7 });
  // floor lamp
  g.beginPath(); g.rect(440, 620, 10, 340); fs(g, '#5a3a28', 2); ell(g, 445, 962, 40, 10); fs(g, '#5a3a28', 2); g.beginPath(); g.moveTo(395, 640); g.lineTo(495, 640); g.lineTo(470, 560); g.lineTo(420, 560); g.closePath(); fs(g, '#fff1c1');
  // rug
  const rugY = 1215; ell(g, 480, rugY, 400, 165); fs(g, pal.rug); ell(g, 480, rugY, 360, 140); g.lineWidth = 4; g.strokeStyle = '#fff6ea'; g.setLineDash([16, 10]); g.stroke(); g.setLineDash([]); ell(g, 480, rugY, 250, 92); fs(g, shade(pal.rug, 0.25), 2);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; circ(g, 480 + Math.cos(a) * 305, rugY + Math.sin(a) * 118, 7); g.fillStyle = '#fff6ea'; g.fill(); }
  // round table with cloth
  const tx = 230, ty = 1030; shadowEll(g, tx, ty + 120, 140, 22); for (const lx of [-90, 80]) { g.beginPath(); g.rect(tx + lx, ty + 10, 14, 110); fs(g, '#7a4f33', 2); }
  g.beginPath(); g.moveTo(tx - 160, ty); g.quadraticCurveTo(tx - 170, ty + 70, tx - 150, ty + 80); g.lineTo(tx + 150, ty + 80); g.quadraticCurveTo(tx + 170, ty + 70, tx + 160, ty); g.closePath(); fs(g, '#fff6ea'); ell(g, tx, ty, 160, 44); fs(g, '#fffaf2');
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(tx - 150 + i * 50, ty + 78); g.lineTo(tx - 140 + i * 50, ty + 92); g.lineTo(tx - 128 + i * 50, ty + 78); g.fillStyle = '#e76f51'; g.fill(); }
  spots.push({ x: tx - 120, y: ty - 26, w: 240, h: 40, wt: 0.8 });
  // vase of flowers on table
  rr(g, tx + 70, ty - 70, 36, 60, 14); fs(g, '#6d9dc5', 2.5); for (let i = 0; i < 6; i++) flower(g, tx + 70 + r() * 40, ty - 80 - r() * 40, 1.1, pick(r, FLOWC));
  // big plant, basket with yarn, cat, boxes, slippers, papers, toy blocks
  plant(g, r, 90, 1440, 1.25, '#e9c46a');
  const bx = 820, by = 1380; shadowEll(g, bx, by + 50, 110, 18); for (const [yx, yy, yc] of [[-40, -10, '#e63946'], [10, -25, '#3a86ff'], [50, -8, '#ffd23f'], [-5, 5, '#52b788']]) { circ(g, bx + yx, by + yy, 34); fs(g, yc, 2.5); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(bx + yx + k * 10, by + yy, 26, -1, 1); g.stroke(); } }
  g.beginPath(); g.moveTo(bx - 100, by); g.lineTo(bx + 100, by); g.lineTo(bx + 80, by + 60); g.lineTo(bx - 80, by + 60); g.closePath(); fs(g, '#c9975c'); g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(bx - 100 + k * 3, by + k * 15); g.lineTo(bx + 100 - k * 3, by + k * 15); g.stroke(); }
  // sleeping cat on the rug
  const kx = 640, ky = 1265, kc = pick(r, ['#f4a261', '#8d8d8d', '#2b2d42', '#f1e3d3']); shadowEll(g, kx, ky + 30, 80, 14); ell(g, kx, ky, 75, 40); fs(g, kc); circ(g, kx - 55, ky - 15, 30); fs(g, kc);
  for (const ex of [-75, -42]) { g.beginPath(); g.moveTo(kx + ex, ky - 35); g.lineTo(kx + ex + 8, ky - 58); g.lineTo(kx + ex + 18, ky - 38); g.closePath(); fs(g, kc, 2.5); }
  g.beginPath(); g.moveTo(kx - 68, ky - 15); g.quadraticCurveTo(kx - 62, ky - 10, kx - 56, ky - 15); g.moveTo(kx - 50, ky - 15); g.quadraticCurveTo(kx - 44, ky - 10, kx - 38, ky - 15); g.lineWidth = 2.5; g.stroke();
  g.beginPath(); g.moveTo(kx + 70, ky + 10); g.quadraticCurveTo(kx + 110, ky + 40, kx + 40, ky + 42); g.lineWidth = 14; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 9; g.strokeStyle = kc; g.stroke();
  g.font = 'bold 22px sans-serif'; g.fillStyle = 'rgba(61,43,36,.6)'; g.fillText('z', kx - 30, ky - 55); g.font = 'bold 16px sans-serif'; g.fillText('z', kx - 15, ky - 75);
  for (const [px, py, w, h, c] of [[880, 1010, 90, 80, '#d4a373'], [895, 950, 70, 62, '#e9c48f']]) { rr(g, px, py, w, h, 5); fs(g, c); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(px + w / 2 - 6, py, 12, h); }
  for (let i = 0; i < 6; i++) { const x = 60 + r() * 880, y = 960 + r() * 500; g.save(); g.translate(x, y); g.rotate(r() * 6); const t = r(); if (t < 0.4) { g.beginPath(); g.rect(-28, -20, 56, 40); fs(g, '#fffdf6', 2); g.strokeStyle = '#a8c5e0'; g.lineWidth = 1.5; for (let k = -10; k <= 10; k += 7) { g.beginPath(); g.moveTo(-22, k); g.lineTo(22, k); g.stroke(); } } else if (t < 0.7) { rr(g, -15, -15, 30, 30, 5); fs(g, pick(r, ['#ff6b6b', '#4cc9f0', '#ffd23f', '#52b788']), 2.5); } else { ell(g, 0, 0, 34, 15); fs(g, pick(r, ['#ffafcc', '#a2d2ff']), 2.5); } g.restore(); }
  spots.push({ x: 120, y: 1110, w: 720, h: 230, wt: 1.6 }, { x: 40, y: 940, w: 400, h: 60, wt: 0.6 }, { x: 60, y: 1340, w: 640, h: 120, wt: 0.9 });
  return { spots, cover: 'cloth', side: pal.wall[1], name: night ? 'Moonlit Den' : 'Sunny Den' };
}

// ================================================================ GARDEN
function garden(g, r) {
  const grassC = pick(r, ['#8fd17a', '#9ad38a', '#7fca83']), skyB = pick(r, [['#9ed8f5', '#e4f6ff'], ['#ffd7b8', '#fff1df']]);
  g.fillStyle = grad(g, 0, 330, skyB); g.fillRect(0, 0, WW, 340); g.fillStyle = skyB[1]; g.fillRect(0, 335, WW, 200);
  for (let i = 0; i < 4; i++) { const cx = r() * WW, cy = 40 + r() * 140; g.fillStyle = 'rgba(255,255,255,.85)'; for (let k = 0; k < 5; k++) { ell(g, cx + (k - 2) * 28, cy + Math.sin(k * 2) * 6, 34, 16); g.fill(); } }
  // cottage
  const hx = 560, hy = 110; g.beginPath(); g.moveTo(hx - 30, hy + 130); g.lineTo(hx + 190, hy - 20); g.lineTo(hx + 470, hy + 130); g.closePath(); fs(g, '#c8553d');
  g.strokeStyle = 'rgba(80,30,20,.4)'; g.lineWidth = 2; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(hx - 30 + k * 30, hy + 130 - k * 22); g.lineTo(hx + 470 - k * 40, hy + 130 - k * 22 + k * 1.5); g.stroke(); }
  g.beginPath(); g.rect(hx, hy + 128, 420, 290); fs(g, '#fff1d6'); rr(g, hx + 170, hy + 250, 85, 168, 40); fs(g, '#4f86c6'); circ(g, hx + 240, hy + 340, 6); fs(g, '#ffd23f', 2);
  for (const wx2 of [hx + 45, hx + 300]) { g.beginPath(); g.rect(wx2, hy + 190, 80, 80); fs(g, '#bde0fe'); g.beginPath(); g.moveTo(wx2 + 40, hy + 190); g.lineTo(wx2 + 40, hy + 270); g.moveTo(wx2, hy + 230); g.lineTo(wx2 + 80, hy + 230); g.lineWidth = 4; g.stroke(); rr(g, wx2 - 8, hy + 270, 96, 20, 4); fs(g, '#a0522d'); for (let k = 0; k < 6; k++) flower(g, wx2 + 6 + k * 14, hy + 268, 0.9, pick(r, FLOWC)); }
  g.beginPath(); g.rect(hx + 310, hy - 10, 40, 80); fs(g, '#9c6644');
  // tree left
  g.beginPath(); g.moveTo(140, 560); g.quadraticCurveTo(160, 380, 130, 220); g.lineTo(190, 220); g.quadraticCurveTo(200, 400, 230, 560); g.closePath(); fs(g, '#8d5a3a');
  for (let i = 0; i < 14; i++) { circ(g, 165 + (r() - 0.5) * 320, 170 + (r() - 0.5) * 200, 60 + r() * 40); fs(g, i % 2 ? '#4f9d69' : '#5fb37a', 2.5); }
  for (let i = 0; i < 9; i++) { circ(g, 165 + (r() - 0.5) * 260, 170 + (r() - 0.5) * 170, 11); fs(g, '#e63946', 2); }
  // lawn
  g.fillStyle = grad(g, 380, HH, [grassC, shade(grassC, -0.18)]); g.beginPath(); g.moveTo(0, 470); g.quadraticCurveTo(500, 420, WW, 500); g.lineTo(WW, HH); g.lineTo(0, HH); g.fill();
  // fence
  for (let x = -10; x < WW; x += 44) { if (x > hx - 40 && x < hx + 440) continue; g.beginPath(); g.moveTo(x, 520); g.lineTo(x, 430); g.lineTo(x + 16, 412); g.lineTo(x + 32, 430); g.lineTo(x + 32, 520); g.closePath(); fs(g, '#fff6ea', 2.5); }
  for (const fy of [450, 495]) { g.beginPath(); g.rect(0, fy, hx - 40, 10); fs(g, '#f0e2c8', 2); }
  bush(g, r, 820, 560, 300, '#4f9d69'); bush(g, r, 300, 560, 260, '#5fa86f');
  // path stones
  const spots = [];
  let px = 610, py = 560; for (let i = 0; i < 16; i++) { stone(g, px + (r() - 0.5) * 20, py, 44 + i * 1.8, 18 + i * 0.9, '#d6ccbd'); py += 58; px += Math.sin(i * 0.7) * 34 - 6; }
  // flower beds
  for (const [bx, by, bw, bh] of [[40, 640, 380, 170], [700, 1020, 270, 200]]) { rr(g, bx, by, bw, bh, 40); fs(g, '#8c5a3c'); rr(g, bx + 10, by + 10, bw - 20, bh - 20, 34); g.fillStyle = '#7a4c32'; g.fill();
    for (let i = 0; i < 40; i++) { const x = bx + 25 + r() * (bw - 50), y = by + 25 + r() * (bh - 50); g.beginPath(); g.moveTo(x, y + 18); g.lineTo(x, y); g.strokeStyle = '#3f7d4e'; g.lineWidth = 3; g.stroke(); flower(g, x, y, 1.2 + r() * 0.5, pick(r, FLOWC)); }
    spots.push({ x: bx + 20, y: by + 20, w: bw - 40, h: bh - 40, wt: 0.5 }); }
  // pond
  const qx = 260, qy = 1060; ell(g, qx, qy, 210, 110); fs(g, '#4fb0d9'); ell(g, qx, qy + 6, 185, 90); g.fillStyle = '#6cc4e8'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(qx - 80 + k * 50, qy - 20 + k * 18, 25, 0.3, 2.5); g.stroke(); }
  for (let i = 0; i < 4; i++) { const lx = qx - 120 + r() * 240, ly = qy - 50 + r() * 100; g.beginPath(); g.moveTo(lx, ly); g.arc(lx, ly, 26, 0.4, Math.PI * 2 - 0.1); g.closePath(); fs(g, '#52b788', 2.5); if (i % 2) flower(g, lx + 5, ly - 5, 1, '#ffc8dd'); }
  for (let i = 0; i < 10; i++) stone(g, qx + Math.cos(i * 0.63) * 215, qy + Math.sin(i * 0.63) * 112, 20 + r() * 10, 13, pick(r, ['#b9b2a6', '#a8a196', '#c9c2b6']));
  for (let i = 0; i < 6; i++) { const rx2 = qx + 150 + i * 9, ry2 = qy - 70; g.beginPath(); g.moveTo(rx2, ry2 + 60); g.quadraticCurveTo(rx2 - 4, ry2, rx2 + 6, ry2 - 30 - i * 4); g.strokeStyle = '#3f7d4e'; g.lineWidth = 4; g.stroke(); if (i % 2) { ell(g, rx2 + 6, ry2 - 30 - i * 4, 5, 14); fs(g, '#7a4f2e', 2); } }
  // veggie rows
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) { const x = 90 + i * 60, y = 1270 + row * 70; ell(g, x, y + 14, 24, 8); g.fillStyle = 'rgba(80,50,30,.35)'; g.fill(); circ(g, x, y, 20); fs(g, row === 1 ? '#a7d676' : '#6fbf73', 2.5); circ(g, x, y, 9); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill(); }
  // bench, birdhouse, wheelbarrow, gnome
  rr(g, 690, 760, 230, 22, 6); fs(g, '#b5835a'); rr(g, 690, 720, 230, 18, 6); fs(g, '#b5835a'); for (const lx of [705, 895]) { g.beginPath(); g.rect(lx, 782, 12, 50); fs(g, '#6b4a35', 2); }
  g.beginPath(); g.rect(935, 620, 12, 240); fs(g, '#6b4a35', 2); g.beginPath(); g.rect(905, 570, 72, 60); fs(g, '#f4a261'); g.beginPath(); g.moveTo(895, 575); g.lineTo(941, 535); g.lineTo(987, 575); g.closePath(); fs(g, '#c8553d'); circ(g, 941, 600, 12); fs(g, '#3d2b24', 0);
  const wbx = 500, wby = 1340; circ(g, wbx + 120, wby + 60, 26); fs(g, '#3d2b24'); g.beginPath(); g.moveTo(wbx, wby - 10); g.lineTo(wbx + 170, wby - 10); g.lineTo(wbx + 140, wby + 50); g.lineTo(wbx + 30, wby + 50); g.closePath(); fs(g, '#6d9dc5'); g.beginPath(); g.moveTo(wbx + 10, wby + 30); g.lineTo(wbx - 70, wby + 70); g.lineWidth = 8; g.strokeStyle = OUT; g.stroke();
  for (let i = 0; i < 4; i++) { circ(g, wbx + 40 + i * 30, wby - 18, 16); fs(g, '#9c6644', 2); }
  const gx = 470, gy = 980; shadowEll(g, gx, gy + 60, 34, 8); ell(g, gx, gy + 30, 30, 32); fs(g, '#4f86c6'); circ(g, gx, gy - 6, 20); fs(g, '#ffd7ba'); g.beginPath(); g.moveTo(gx - 22, gy - 12); g.lineTo(gx, gy - 75); g.lineTo(gx + 22, gy - 12); g.closePath(); fs(g, '#e63946'); g.beginPath(); g.moveTo(gx - 18, gy + 2); g.quadraticCurveTo(gx, gy + 50, gx + 18, gy + 2); fs(g, '#fff', 2.5);
  // texture: tufts, little flowers, pebbles, mushrooms
  for (let i = 0; i < 260; i++) { const x = r() * WW, y = 520 + r() * 980; grassTuft(g, x, y, 0.8 + r() * 0.7, r() < 0.5 ? shade(grassC, -0.25) : shade(grassC, 0.15)); }
  for (let i = 0; i < 40; i++) flower(g, r() * WW, 560 + r() * 930, 0.7, pick(r, FLOWC));
  for (let i = 0; i < 20; i++) stone(g, r() * WW, 560 + r() * 930, 8 + r() * 10, 6 + r() * 5);
  spots.push({ x: 30, y: 860, w: 940, h: 120, wt: 1.2 }, { x: 460, y: 1120, w: 520, h: 200, wt: 1.2 }, { x: 40, y: 1420, w: 920, h: 60, wt: 0.8 }, { x: 60, y: 560, w: 880, h: 60, wt: 0.6 }, { x: 520, y: 600, w: 160, h: 750, wt: 0.6 });
  return { spots, cover: 'grass', side: shade(grassC, -0.1), name: 'Cottage Garden' };
}

// ================================================================ BEACH
function beach(g, r) {
  const sea = pick(r, [['#2fa9d6', '#61d0e8'], ['#2b8fc7', '#59c3e6']]), sand = pick(r, ['#f6dca6', '#f3d39a', '#f8e2b8']);
  g.fillStyle = grad(g, 0, 330, ['#7cc9f4', '#d6f1ff', '#fff3d8']); g.fillRect(0, 0, WW, 340);
  circ(g, 780, 120, 60); g.fillStyle = '#fff1a8'; g.fill(); g.globalAlpha = 0.3; circ(g, 780, 120, 90); g.fill(); g.globalAlpha = 1;
  for (let i = 0; i < 3; i++) { const cx = 100 + r() * 600, cy = 60 + r() * 120; g.fillStyle = 'rgba(255,255,255,.9)'; for (let k = 0; k < 5; k++) { ell(g, cx + (k - 2) * 26, cy + Math.sin(k * 2) * 5, 30, 13); g.fill(); } }
  g.strokeStyle = OUT; g.lineWidth = 3; for (let i = 0; i < 5; i++) { const x = 120 + r() * 700, y = 80 + r() * 160; g.beginPath(); g.moveTo(x - 14, y); g.quadraticCurveTo(x - 7, y - 8, x, y); g.quadraticCurveTo(x + 7, y - 8, x + 14, y); g.stroke(); }
  // island
  g.beginPath(); g.moveTo(80, 330); g.quadraticCurveTo(170, 250, 280, 330); g.closePath(); fs(g, '#5fa86f', 2.5);
  g.fillStyle = grad(g, 320, 600, sea); g.fillRect(0, 320, WW, 300); g.beginPath(); g.moveTo(0, 322); g.lineTo(WW, 322); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 3; for (let i = 0; i < 30; i++) { const x = r() * WW, y = 345 + r() * 230; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 15, y - 7, x + 30, y); g.stroke(); }
  // sailboat
  const sbx = 640, sby = 410; g.beginPath(); g.moveTo(sbx - 60, sby); g.lineTo(sbx + 60, sby); g.lineTo(sbx + 40, sby + 25); g.lineTo(sbx - 40, sby + 25); g.closePath(); fs(g, '#e63946'); g.beginPath(); g.moveTo(sbx, sby); g.lineTo(sbx, sby - 110); g.lineTo(sbx + 55, sby - 10); g.closePath(); fs(g, '#fff'); g.beginPath(); g.moveTo(sbx - 5, sby - 95); g.lineTo(sbx - 50, sby - 10); g.lineTo(sbx - 5, sby - 10); g.closePath(); fs(g, '#ffd23f');
  // foam + sand
  g.fillStyle = grad(g, 560, HH, [shade(sand, -0.08), sand, shade(sand, -0.06)]); g.beginPath(); g.moveTo(0, 600); for (let x = 0; x <= WW; x += 25) g.lineTo(x, 590 + Math.sin(x * 0.02) * 18); g.lineTo(WW, HH); g.lineTo(0, HH); g.fill();
  g.beginPath(); for (let x = 0; x <= WW; x += 25) g.lineTo(x, 588 + Math.sin(x * 0.02) * 18); g.strokeStyle = '#fff'; g.lineWidth = 10; g.stroke(); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
  for (let i = 0; i < 700; i++) { circ(g, r() * WW, 620 + r() * 880, 1.5 + r() * 2); g.fillStyle = r() < 0.5 ? 'rgba(160,110,60,.25)' : 'rgba(255,255,255,.35)'; g.fill(); }
  const spots = [];
  // towels
  for (const [tx, ty, rot, c] of [[230, 900, -0.15, '#ff6b8b'], [700, 1250, 0.12, '#4cc9f0'], [260, 1330, 0.05, '#ffd23f']]) { g.save(); g.translate(tx, ty); g.rotate(rot); shadowEll(g, 4, 6, 160, 80, 0.08); rr(g, -150, -75, 300, 150, 10); fs(g, c); g.fillStyle = '#fff'; for (let k = -120; k < 150; k += 60) g.fillRect(k, -75, 22, 150); g.strokeStyle = OUT; g.lineWidth = L; rr(g, -150, -75, 300, 150, 10); g.stroke(); g.restore(); spots.push({ x: tx - 130, y: ty - 55, w: 260, h: 110, wt: 0.9 }); }
  // umbrellas
  for (const [ux, uy, c1, c2] of [[420, 760, '#ef476f', '#fff'], [860, 1060, '#06d6a0', '#ffd166']]) { shadowEll(g, ux + 40, uy + 230, 150, 40, 0.15); g.beginPath(); g.rect(ux - 5, uy - 150, 10, 380); fs(g, '#8d5a3a', 2);
    const ay = uy - 165, by = uy - 45, rx = 175;
    const dome = () => { g.beginPath(); g.moveTo(ux - rx, by); g.bezierCurveTo(ux - rx, ay - 10, ux + rx, ay - 10, ux + rx, by); for (let k = 0; k < 6; k++) { const x0 = ux + rx - k * rx / 3, x1 = x0 - rx / 3; g.quadraticCurveTo((x0 + x1) / 2, by - 22, x1, by); } g.closePath(); };
    dome(); g.save(); g.clip(); for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(ux, ay - 30); g.lineTo(ux - rx + k * rx / 3, by + 5); g.lineTo(ux - rx + (k + 1) * rx / 3, by + 5); g.closePath(); g.fillStyle = k % 2 ? c1 : c2; g.fill(); g.strokeStyle = 'rgba(61,43,36,.35)'; g.lineWidth = 2; g.stroke(); } g.restore();
    dome(); g.lineWidth = L; g.strokeStyle = OUT; g.stroke(); circ(g, ux, ay + 8, 8); fs(g, '#8d5a3a', 2); }
  // sandcastle
  const cx = 560, cy = 980; shadowEll(g, cx, cy + 60, 130, 20, 0.12); g.beginPath(); g.rect(cx - 110, cy - 20, 220, 80); fs(g, '#e8c27f'); for (const tx2 of [-110, 50]) { g.beginPath(); g.rect(cx + tx2, cy - 90, 60, 75); fs(g, '#e8c27f'); for (let k = 0; k < 3; k++) { g.beginPath(); g.rect(cx + tx2 + k * 22, cy - 104, 14, 16); fs(g, '#e8c27f', 2); } }
  g.beginPath(); g.rect(cx - 30, cy - 130, 60, 110); fs(g, '#f0cf91'); g.beginPath(); g.moveTo(cx, cy - 130); g.lineTo(cx, cy - 180); g.lineWidth = 3; g.stroke(); g.beginPath(); g.moveTo(cx, cy - 180); g.lineTo(cx + 34, cy - 168); g.lineTo(cx, cy - 156); g.closePath(); fs(g, '#e63946', 2); rr(g, cx - 18, cy + 10, 36, 50, 16); fs(g, '#a87b4d');
  // palm tree
  g.beginPath(); g.moveTo(920, 980); g.quadraticCurveTo(880, 700, 960, 520); g.lineTo(990, 530); g.quadraticCurveTo(920, 720, 970, 980); g.closePath(); fs(g, '#b07c4f'); for (let k = 0; k < 9; k++) { const y = 560 + k * 46; g.beginPath(); g.moveTo(920 + Math.sin(k) * 6 + (k < 4 ? 30 : 0) - k * 3, y); g.lineTo(965 - k * 2, y + 6); g.lineWidth = 2; g.stroke(); }
  for (let k = 0; k < 6; k++) { const a = Math.PI * (0.9 + k * 0.22); g.beginPath(); g.moveTo(975, 525); g.quadraticCurveTo(975 + Math.cos(a) * 120, 525 + Math.sin(a) * 120 - 50, 975 + Math.cos(a) * 200, 525 + Math.sin(a) * 160 + 30); g.quadraticCurveTo(975 + Math.cos(a) * 100, 525 + Math.sin(a) * 90, 975, 535); fs(g, k % 2 ? '#3f9d58' : '#55b56b', 2.5); }
  for (const [ox, oy] of [[960, 540], [985, 548], [970, 560]]) { circ(g, ox, oy, 14); fs(g, '#7a4f2e', 2); }
  // rocks + seaweed
  for (const [rx2, ry2] of [[80, 700], [130, 760], [60, 790]]) stone(g, rx2, ry2, 55 + r() * 20, 35, '#9ca3a8');
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(40 + i * 25, 820); g.quadraticCurveTo(30 + i * 25, 780, 50 + i * 25, 750); g.strokeStyle = '#2d6a4f'; g.lineWidth = 5; g.stroke(); }
  // buckets, beach ball, crabs, starfish decor, footprints, driftwood, cooler
  for (const [bx, by, c] of [[150, 1100, '#ff6b6b'], [780, 1440, '#3a86ff']]) { g.beginPath(); g.moveTo(bx - 34, by - 40); g.lineTo(bx + 34, by - 40); g.lineTo(bx + 26, by + 20); g.lineTo(bx - 26, by + 20); g.closePath(); fs(g, c); g.beginPath(); g.arc(bx, by - 40, 34, Math.PI, 0); g.lineWidth = 3; g.stroke(); }
  const bbx = 640, bby = 1440; circ(g, bbx, bby, 42); fs(g, '#fff'); for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(bbx, bby); g.arc(bbx, bby, 42, k * 2.09, k * 2.09 + 1.05); g.closePath(); fs(g, ['#e63946', '#3a86ff', '#ffd23f'][k], 2); }
  for (const [kx, ky] of [[330, 1130], [900, 1350]]) { ell(g, kx, ky, 26, 18); fs(g, '#e85d4a'); for (const s of [-1, 1]) { circ(g, kx + s * 32, ky - 12, 10); fs(g, '#e85d4a', 2); for (let l = 0; l < 3; l++) { g.beginPath(); g.moveTo(kx + s * 20, ky + l * 6); g.lineTo(kx + s * 36, ky + 6 + l * 8); g.lineWidth = 3; g.stroke(); } } for (const s of [-1, 1]) { circ(g, kx + s * 8, ky - 20, 4); fs(g, '#fff', 1.5); } }
  g.fillStyle = 'rgba(150,100,55,.3)'; for (let i = 0; i < 14; i++) { ell(g, 380 + i * 30 + (i % 2) * 14, 1500 - i * 52, 7, 11, 0.4); g.fill(); }
  rr(g, 40, 1220, 150, 30, 15); fs(g, '#c9a27a'); rr(g, 860, 820, 110, 70, 8); fs(g, '#4cc9f0'); g.beginPath(); g.rect(860, 820, 110, 20); fs(g, '#fff', 2.5);
  for (let i = 0; i < 30; i++) stone(g, r() * WW, 640 + r() * 840, 5 + r() * 7, 4 + r() * 4, pick(r, ['#e2d1b8', '#cdbba0', '#f1e6d4']));
  spots.push({ x: 40, y: 640, w: 900, h: 120, wt: 1 }, { x: 40, y: 1000, w: 420, h: 200, wt: 1 }, { x: 400, y: 1090, w: 560, h: 90, wt: 0.8 }, { x: 40, y: 1400, w: 700, h: 80, wt: 0.8 });
  return { spots, cover: 'sand', side: sand, name: 'Sunny Cove' };
}

// ================================================================ CAMP
function camp(g, r) {
  const sky = pick(r, [['#5b4b8a', '#c56d86', '#ffb26b'], ['#3d5a80', '#98c1d9', '#ffd6a5']]);
  g.fillStyle = grad(g, 0, 520, sky); g.fillRect(0, 0, WW, 540);
  for (let i = 0; i < 40; i++) { circ(g, r() * WW, r() * 220, 1 + r() * 1.8); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); }
  circ(g, 200, 110, 40); g.fillStyle = '#fff4d6'; g.fill(); circ(g, 218, 98, 36); g.fillStyle = sky[0]; g.globalAlpha = 0.95; g.fill(); g.globalAlpha = 1;
  g.fillStyle = shade(sky[1], -0.25); g.beginPath(); g.moveTo(0, 430); g.lineTo(180, 260); g.lineTo(330, 400); g.lineTo(520, 230); g.lineTo(760, 420); g.lineTo(880, 300); g.lineTo(WW, 380); g.lineTo(WW, 540); g.lineTo(0, 540); g.fill();
  g.fillStyle = '#fff'; g.globalAlpha = 0.8; for (const [x, y] of [[180, 260], [520, 230], [880, 300]]) { g.beginPath(); g.moveTo(x - 30, y + 28); g.lineTo(x, y); g.lineTo(x + 30, y + 28); g.lineTo(x + 10, y + 22); g.lineTo(x, y + 30); g.fill(); } g.globalAlpha = 1;
  // lake
  g.fillStyle = grad(g, 470, 560, ['#7fb8d6', '#4f86a8']); g.fillRect(0, 470, WW, 90); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const x = r() * WW, y = 485 + r() * 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.stroke(); }
  for (let x = -20; x < WW + 40; x += 55 + r() * 30) pine(g, x, 480 - r() * 20, 120 + r() * 60, '#2f5d50');
  // ground
  const gr = pick(r, ['#7fae5e', '#8ab36a']); g.fillStyle = grad(g, 540, HH, [gr, shade(gr, -0.25)]); g.fillRect(0, 540, WW, 960); g.beginPath(); g.moveTo(0, 545); g.lineTo(WW, 545); g.strokeStyle = OUT; g.lineWidth = L; g.stroke();
  for (let i = 0; i < 220; i++) grassTuft(g, r() * WW, 560 + r() * 940, 0.8 + r() * 0.6, r() < 0.5 ? shade(gr, -0.3) : shade(gr, 0.18));
  for (let i = 0; i < 160; i++) { const x = r() * WW, y = 560 + r() * 940; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 * Math.cos(i), y + 8 * Math.sin(i)); g.strokeStyle = 'rgba(110,70,40,.45)'; g.lineWidth = 2; g.stroke(); }
  // big pines on sides
  pine(g, 70, 900, 420, '#2d6a4f'); pine(g, 950, 760, 360, '#40916c');
  // string lights
  g.beginPath(); g.moveTo(80, 560); g.quadraticCurveTo(500, 700, 940, 470); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  for (let i = 1; i < 16; i++) { const t = i / 16, x = (1 - t) * (1 - t) * 80 + 2 * (1 - t) * t * 500 + t * t * 940, y = (1 - t) * (1 - t) * 560 + 2 * (1 - t) * t * 700 + t * t * 470; g.save(); g.globalAlpha = 0.35; circ(g, x, y + 10, 18); g.fillStyle = '#fff3b0'; g.fill(); g.restore(); circ(g, x, y + 10, 8); fs(g, pick(r, ['#ffd166', '#ff6b8b', '#7ad3ff', '#b5e48c']), 2); }
  // tent
  const tx = 280, ty = 860; shadowEll(g, tx, ty + 5, 260, 30, 0.18); g.beginPath(); g.moveTo(tx - 250, ty); g.lineTo(tx - 20, ty - 300); g.lineTo(tx + 210, ty); g.closePath(); fs(g, '#f4a261'); g.beginPath(); g.moveTo(tx - 80, ty); g.lineTo(tx - 20, ty - 300); g.lineTo(tx + 50, ty); g.closePath(); fs(g, '#4a2f25'); g.beginPath(); g.moveTo(tx - 20, ty - 300); g.lineTo(tx + 60, ty); g.lineTo(tx + 120, ty - 30); g.closePath(); fs(g, '#e76f51');
  g.beginPath(); g.moveTo(tx - 20, ty - 300); g.lineTo(tx - 20, ty - 330); g.lineWidth = 4; g.stroke(); g.beginPath(); g.moveTo(tx - 20, ty - 330); g.lineTo(tx + 20, ty - 318); g.lineTo(tx - 20, ty - 306); g.closePath(); fs(g, '#ffd166', 2);
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(tx - 20 + s * 120, ty - 150); g.lineTo(tx - 20 + s * 290, ty + 20); g.strokeStyle = '#e9ecef'; g.lineWidth = 2; g.stroke(); }
  // campfire
  const fx = 560, fy = 1110; g.save(); const glow = g.createRadialGradient(fx, fy - 30, 10, fx, fy - 30, 260); glow.addColorStop(0, 'rgba(255,200,90,.55)'); glow.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = glow; g.fillRect(fx - 270, fy - 300, 540, 540); g.restore();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; stone(g, fx + Math.cos(a) * 80, fy + Math.sin(a) * 34, 22, 15, '#8d8a85'); }
  for (const a of [-0.4, 0.4, 0]) { g.save(); g.translate(fx, fy - 6); g.rotate(a); rr(g, -70, -10, 140, 20, 9); fs(g, '#7a4f2e'); g.restore(); }
  for (const [s, c] of [[1, '#ff7b29'], [0.7, '#ffb703'], [0.4, '#fff3b0']]) { g.beginPath(); g.moveTo(fx - 45 * s, fy - 10); g.quadraticCurveTo(fx - 50 * s, fy - 80 * s, fx, fy - 150 * s); g.quadraticCurveTo(fx + 50 * s, fy - 80 * s, fx + 45 * s, fy - 10); g.closePath(); fs(g, c, s === 1 ? 2.5 : 0); }
  // logs to sit on, stumps, lantern, backpack, firewood pile, ferns, mushrooms, rocks, canoe
  for (const [lx, ly, w] of [[330, 1130, 170], [690, 1250, 190], [700, 960, 160]]) { rr(g, lx, ly, w, 46, 22); fs(g, '#9c6644'); ell(g, lx + w - 6, ly + 23, 16, 22); fs(g, '#d4a373', 2.5); g.beginPath(); g.arc(lx + w - 6, ly + 23, 8, 0, 6); g.lineWidth = 1.5; g.stroke(); }
  for (const [sx, sy] of [[840, 1150], [110, 1220]]) { rr(g, sx - 40, sy - 50, 80, 70, 8); fs(g, '#8d5a3a'); ell(g, sx, sy - 50, 40, 14); fs(g, '#d4a373', 2.5); }
  const lnx = 840, lny = 1080; g.save(); const lg = g.createRadialGradient(lnx, lny, 5, lnx, lny, 90); lg.addColorStop(0, 'rgba(255,230,140,.6)'); lg.addColorStop(1, 'rgba(255,230,140,0)'); g.fillStyle = lg; g.fillRect(lnx - 90, lny - 90, 180, 180); g.restore(); rr(g, lnx - 18, lny - 25, 36, 50, 6); fs(g, '#ffe8a3'); g.beginPath(); g.rect(lnx - 22, lny - 32, 44, 10); fs(g, '#2b2d42', 2); g.beginPath(); g.arc(lnx, lny - 36, 12, Math.PI, 0); g.lineWidth = 3; g.stroke();
  rr(g, 470, 820, 90, 110, 26); fs(g, '#3a86ff'); rr(g, 485, 870, 60, 45, 12); fs(g, '#2667cc'); g.beginPath(); g.rect(495, 812, 40, 14); fs(g, '#2b2d42', 2);
  for (let i = 0; i < 6; i++) { g.save(); g.translate(150 + (i % 3) * 30, 1400 - Math.floor(i / 3) * 34); rr(g, -50, -14, 100, 28, 14); fs(g, '#9c6644', 2.5); ell(g, 46, 0, 10, 13); fs(g, '#d4a373', 2); g.restore(); }
  const fern = (x, y, s) => { for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.35; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 50 * s, y + Math.sin(a) * 50 * s - 10, x + Math.cos(a) * 85 * s, y + Math.sin(a) * 75 * s); g.strokeStyle = '#2d6a4f'; g.lineWidth = 7 * s; g.stroke(); g.strokeStyle = '#52b788'; g.lineWidth = 4 * s; g.stroke(); } };
  for (let i = 0; i < 7; i++) fern(r() * WW, 620 + r() * 860, 0.7 + r() * 0.5);
  for (let i = 0; i < 8; i++) { const x = r() * WW, y = 640 + r() * 840, s = 0.6 + r() * 0.5; rr(g, x - 5 * s, y - 14 * s, 10 * s, 18 * s, 4); fs(g, '#fff1dc', 2); g.beginPath(); g.arc(x, y - 12 * s, 16 * s, Math.PI, 0); g.closePath(); fs(g, pick(r, ['#c99a4b', '#e9c46a', '#bc6c25']), 2); }
  for (let i = 0; i < 14; i++) stone(g, r() * WW, 600 + r() * 880, 10 + r() * 16, 7 + r() * 8, pick(r, ['#9a9a94', '#b5b2aa']));
  g.save(); g.translate(820, 640); g.rotate(-0.08); g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(0, 60, 150, 0); g.quadraticCurveTo(0, 20, -150, 0); fs(g, '#c8553d'); g.restore();
  const spots = [{ x: 40, y: 900, w: 920, h: 160, wt: 1.3 }, { x: 40, y: 1180, w: 450, h: 260, wt: 1.1 }, { x: 640, y: 1300, w: 330, h: 170, wt: 0.9 }, { x: 600, y: 600, w: 380, h: 120, wt: 0.6 }, { x: 40, y: 600, w: 160, h: 220, wt: 0.4 }];
  return { spots, cover: 'fern', side: shade(gr, -0.2), name: 'Lakeside Camp' };
}

export const THEMES = [room, garden, beach, camp];

/** a small scenery shape drawn OVER part of an item so it is half tucked away */
export function drawCover(g, kind, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.lineJoin = 'round'; g.lineCap = 'round';
  if (kind === 'grass' || kind === 'fern') {
    const c1 = kind === 'fern' ? '#2d6a4f' : '#3f7d4e', c2 = kind === 'fern' ? '#52b788' : '#7cc47a';
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * s * 0.12, s * 0.5); g.quadraticCurveTo(k * s * 0.25, -s * 0.1, k * s * 0.42, -s * (0.55 - Math.abs(k) * 0.08)); g.strokeStyle = c1; g.lineWidth = s * 0.16; g.stroke(); g.strokeStyle = c2; g.lineWidth = s * 0.09; g.stroke(); }
  } else if (kind === 'sand') {
    ell(g, 0, s * 0.35, s * 0.85, s * 0.42); g.fillStyle = '#f1d49b'; g.fill(); g.strokeStyle = 'rgba(61,43,36,.55)'; g.lineWidth = s * 0.05; g.stroke();
    for (let i = 0; i < 6; i++) { circ(g, (i - 2.5) * s * 0.22, s * (0.25 + (i % 2) * 0.15), s * 0.035); g.fillStyle = 'rgba(160,110,60,.4)'; g.fill(); }
  } else {
    rr(g, -s * 0.7, -s * 0.15, s * 1.4, s * 0.8, s * 0.12); g.fillStyle = '#fffdf6'; g.fill(); g.strokeStyle = OUT; g.lineWidth = s * 0.06; g.stroke(); g.strokeStyle = '#a8c5e0'; g.lineWidth = s * 0.04;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-s * 0.55, s * (0.05 + k * 0.17)); g.lineTo(s * 0.55, s * (0.05 + k * 0.17)); g.stroke(); }
  }
  g.restore();
}
export { drawItem };

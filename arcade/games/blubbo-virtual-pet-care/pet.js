// pet.js — Blubbo, an original gumdrop-shaped jelly pet with a leaf sprout, drawn with canvas paths.
// Also the food, outfit and room props, all drawn in code.
export const INK = '#3d2b4a';
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, t = Math.abs(amt); r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
let g;
const B = () => g.beginPath();
const fill = (c, lw = 0, sc = INK) => { g.fillStyle = c; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = sc; g.stroke(); } };
const ell = (x, y, rx, ry, r = 0) => { g.moveTo(x + rx * Math.cos(r), y + rx * Math.sin(r)); g.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); };

function bodyPath(R) {
  B(); const n = 48;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, s = Math.sin(a), c = Math.cos(a); const ry = s > 0 ? R * 0.78 : R * 1.02, rx = R * (1.06 + (s > 0 ? 0.06 * s : 0)); const x = c * rx, y = s * ry + (s > 0 ? 0 : 0); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath();
}
export const HATS = {
  none: null,
  party: (R, c) => { B(); g.moveTo(-R * 0.32, -R * 0.9); g.lineTo(0, -R * 1.75); g.lineTo(R * 0.32, -R * 0.9); g.closePath(); fill('#ff5d8f', R * 0.04); for (const k of [0.3, 0.55]) { B(); g.moveTo(-R * 0.32 * (1 - k), -R * (0.9 + 0.85 * k)); g.lineTo(R * 0.32 * (1 - k), -R * (0.9 + 0.85 * k)); g.lineWidth = R * 0.06; g.strokeStyle = '#ffd23f'; g.stroke(); } B(); ell(0, -R * 1.78, R * 0.1, R * 0.1); fill('#ffd23f', R * 0.03); },
  beanie: (R) => { B(); g.moveTo(-R * 0.86, -R * 0.55); g.quadraticCurveTo(-R * 0.8, -R * 1.42, 0, -R * 1.42); g.quadraticCurveTo(R * 0.8, -R * 1.42, R * 0.86, -R * 0.55); g.closePath(); fill('#3fa9f5', R * 0.04); B(); g.roundRect(-R * 0.92, -R * 0.68, R * 1.84, R * 0.24, R * 0.12); fill('#2b7fc4', R * 0.04); B(); ell(0, -R * 1.48, R * 0.16, R * 0.16); fill('#ffffff', R * 0.03); },
  crown: (R) => { B(); g.moveTo(-R * 0.5, -R * 0.9); g.lineTo(-R * 0.56, -R * 1.42); g.lineTo(-R * 0.28, -R * 1.18); g.lineTo(0, -R * 1.5); g.lineTo(R * 0.28, -R * 1.18); g.lineTo(R * 0.56, -R * 1.42); g.lineTo(R * 0.5, -R * 0.9); g.closePath(); fill('#ffd23f', R * 0.04); for (const x of [-0.28, 0, 0.28]) { B(); ell(R * x, -R * 1.02, R * 0.07, R * 0.07); fill(x ? '#3fa9f5' : '#ff4d6d'); } },
  bow: (R) => { for (const s of [-1, 1]) { B(); g.moveTo(R * 0.42, -R * 0.98); g.quadraticCurveTo(R * (0.42 + s * 0.45), -R * 1.45, R * (0.42 + s * 0.42), -R * 0.98 + R * 0.02); g.quadraticCurveTo(R * (0.42 + s * 0.45), -R * 0.6, R * 0.42, -R * 0.98); fill('#ff7aa2', R * 0.04); } B(); ell(R * 0.42, -R * 0.98, R * 0.1, R * 0.1); fill('#ff4d6d', R * 0.04); },
  chef: (R) => { B(); g.roundRect(-R * 0.5, -R * 1.12, R, R * 0.3, R * 0.05); fill('#ffffff', R * 0.04); for (const [x, y, r] of [[-0.35, -1.35, 0.3], [0.35, -1.35, 0.3], [0, -1.55, 0.36]]) { B(); ell(R * x, R * y, R * r, R * r); fill('#ffffff', R * 0.04); } B(); g.rect(-R * 0.48, -R * 1.3, R * 0.96, R * 0.2); fill('#ffffff'); },
  flower: (R) => { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B(); ell(-R * 0.55 + Math.cos(a) * R * 0.17, -R * 0.82 + Math.sin(a) * R * 0.17, R * 0.13, R * 0.09, a); fill('#ffffff', R * 0.025); } B(); ell(-R * 0.55, -R * 0.82, R * 0.1, R * 0.1); fill('#ffd23f', R * 0.025); },
  propeller: (R) => { B(); g.moveTo(-R * 0.8, -R * 0.62); g.quadraticCurveTo(0, -R * 1.5, R * 0.8, -R * 0.62); g.closePath(); fill('#ff5d5d', R * 0.04); B(); g.moveTo(-R * 0.27, -R * 0.84); g.quadraticCurveTo(0, -R * 1.24, R * 0.27, -R * 0.84); g.lineWidth = R * 0.1; g.strokeStyle = '#ffd23f'; g.stroke(); g.lineWidth = R * 0.04; g.strokeStyle = INK; B(); g.moveTo(0, -R * 1.07); g.lineTo(0, -R * 1.3); g.stroke(); const t = performance.now() / 90; for (const s of [-1, 1]) { B(); ell(s * Math.cos(t) * R * 0.3, -R * 1.32, Math.abs(Math.cos(t)) * R * 0.3 + 1, R * 0.06); fill(s > 0 ? '#3fa9f5' : '#52b788', R * 0.025); } },
};
export const GLASSES = {
  none: null,
  round: (R) => { g.lineWidth = R * 0.05; g.strokeStyle = INK; for (const s of [-1, 1]) { B(); ell(s * R * 0.34, -R * 0.12, R * 0.27, R * 0.27); g.stroke(); } B(); g.moveTo(-R * 0.08, -R * 0.14); g.lineTo(R * 0.08, -R * 0.14); g.stroke(); },
  star: (R) => { for (const s of [-1, 1]) { B(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? R * 0.15 : R * 0.33; g.lineTo(s * R * 0.34 + Math.cos(a) * q, -R * 0.12 + Math.sin(a) * q); } g.closePath(); g.fillStyle = 'rgba(255,93,143,.35)'; g.fill(); g.lineWidth = R * 0.045; g.strokeStyle = '#ff5d8f'; g.stroke(); } },
  shades: (R) => { for (const s of [-1, 1]) { B(); g.roundRect(s * R * 0.34 - R * 0.27, -R * 0.3, R * 0.54, R * 0.34, R * 0.12); fill('#2b2d42', R * 0.04); B(); ell(s * R * 0.34 - R * 0.1, -R * 0.2, R * 0.08, R * 0.04, -0.4); fill('rgba(255,255,255,.6)'); } g.lineWidth = R * 0.05; B(); g.moveTo(-R * 0.08, -R * 0.2); g.lineTo(R * 0.08, -R * 0.2); g.stroke(); },
  heart: (R) => { for (const s of [-1, 1]) { const x = s * R * 0.34, y = -R * 0.16, k = R * 0.28; B(); g.moveTo(x, y + k * 0.7); g.bezierCurveTo(x - k * 1.2, y - k * 0.1, x - k * 0.5, y - k * 1.0, x, y - k * 0.35); g.bezierCurveTo(x + k * 0.5, y - k * 1.0, x + k * 1.2, y - k * 0.1, x, y + k * 0.7); g.fillStyle = 'rgba(255,77,109,.4)'; g.fill(); g.lineWidth = R * 0.045; g.strokeStyle = '#e8335c'; g.stroke(); } },
};
export const COLORS = ['#7fe0b5', '#ffb3c7', '#9ec9ff', '#ffd36e', '#c7a6ff', '#ff9a6b', '#b8e86a', '#f2f2f2'];

/** o: { color, look:[dx,dy], blink 0..1, mouth: 'smile'|'grin'|'open'|'frown'|'o'|'chew'|'sleep', sx, sy, dirt 0..1, foam 0..1, hat, glasses, sad, t } */
export function drawPet(ctx, x, y, R, o) {
  g = ctx; g.save(); g.translate(x, y + R * 0.78); g.scale(o.sx || 1, o.sy || 1); g.translate(0, -R * 0.78); g.lineJoin = 'round'; g.lineCap = 'round';
  const col = o.color || COLORS[0], dark = shade(col, -0.35), t = o.t || 0;
  // shadow + feet
  g.save(); g.scale(1 / (o.sx || 1), 1); B(); ell(0, R * 0.84, R * 0.95, R * 0.13); g.fillStyle = 'rgba(40,20,60,.16)'; g.fill(); g.restore();
  for (const s of [-1, 1]) { B(); ell(s * R * 0.45, R * 0.72, R * 0.24, R * 0.13); fill(dark, R * 0.035); }
  // sprout
  B(); g.moveTo(0, -R * 0.98); g.quadraticCurveTo(R * 0.05, -R * 1.25, -R * 0.02, -R * 1.38); g.lineWidth = R * 0.06; g.strokeStyle = '#4f9a3a'; g.stroke();
  const sway = Math.sin(t * 2.2) * 0.15;
  for (const s of [-1, 1]) { g.save(); g.translate(-R * 0.02, -R * 1.36); g.rotate(s * 0.9 + sway); B(); g.moveTo(0, 0); g.quadraticCurveTo(R * 0.14, -R * 0.16, 0, -R * 0.36); g.quadraticCurveTo(-R * 0.14, -R * 0.16, 0, 0); fill(s > 0 ? '#7bd06a' : '#5fbf55', R * 0.03); g.restore(); }
  // body
  bodyPath(R); const gr = g.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.1, 0, 0, R * 1.2); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.12)); fill(gr, R * 0.05, dark);
  B(); ell(-R * 0.48, -R * 0.55, R * 0.2, R * 0.11, -0.7); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
  B(); ell(0, R * 0.42, R * 0.55, R * 0.26); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill();
  // dirt
  if (o.dirt > 0.05) { g.globalAlpha = Math.min(1, o.dirt * 1.3); for (const [dx, dy, r] of [[-0.55, 0.15, 0.13], [0.5, 0.3, 0.16], [0.2, -0.6, 0.09], [-0.2, 0.5, 0.1], [0.72, -0.2, 0.08]]) { B(); ell(R * dx, R * dy, R * r, R * r * 0.8, dx); g.fillStyle = '#8a6a48'; g.fill(); } g.globalAlpha = 1;
    if (o.dirt > 0.6) for (let i = 0; i < 2; i++) { const a = t * 3 + i * 3; const fx = Math.cos(a) * R * 0.9, fy = -R * 0.9 + Math.sin(a * 1.7) * R * 0.25; B(); ell(fx, fy, R * 0.04, R * 0.04); fill(INK); B(); ell(fx - R * 0.04, fy - R * 0.05, R * 0.05, R * 0.03, 0.5); ell(fx + R * 0.04, fy - R * 0.05, R * 0.05, R * 0.03, -0.5); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); } }
  // eyes
  const ey = -R * 0.12, lx = (o.look ? o.look[0] : 0) * R * 0.07, ly = (o.look ? o.look[1] : 0) * R * 0.07;
  if (o.mouth === 'sleep') { for (const s of [-1, 1]) { B(); g.arc(s * R * 0.34, ey, R * 0.15, 0.2, Math.PI - 0.2); g.lineWidth = R * 0.05; g.strokeStyle = INK; g.stroke(); } }
  else {
    const bl = 1 - (o.blink || 0);
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * R * 0.34, ey); g.scale(1, Math.max(0.08, bl));
      B(); ell(0, 0, R * 0.25, R * 0.3); fill('#ffffff', R * 0.04);
      B(); ell(lx, ly + R * 0.03, R * 0.15, R * 0.18); fill(INK);
      B(); ell(lx - R * 0.05, ly - R * 0.05, R * 0.055, R * 0.06); g.fillStyle = '#fff'; g.fill(); B(); ell(lx + R * 0.05, ly + R * 0.09, R * 0.025, R * 0.025); g.fill();
      g.restore();
      if (o.sad) { B(); g.moveTo(s * R * 0.15, ey - R * 0.38); g.lineTo(s * R * 0.5, ey - R * 0.32 - R * 0.08); g.lineWidth = R * 0.045; g.strokeStyle = INK; g.stroke(); }
    }
  }
  B(); ell(-R * 0.66, R * 0.16, R * 0.13, R * 0.08); ell(R * 0.66, R * 0.16, R * 0.13, R * 0.08); g.fillStyle = 'rgba(255,90,120,.35)'; g.fill();
  // mouth
  const my = R * 0.25; g.lineWidth = R * 0.045; g.strokeStyle = INK;
  switch (o.mouth) {
    case 'open': B(); ell(0, my + R * 0.05, R * 0.2, R * 0.2); fill('#7a2840', R * 0.04); B(); ell(0, my + R * 0.15, R * 0.11, R * 0.07); fill('#ff7a8a'); break;
    case 'o': B(); ell(0, my + R * 0.04, R * 0.08, R * 0.1); fill('#7a2840', R * 0.04); break;
    case 'chew': { const k = Math.abs(Math.sin(t * 14)); B(); ell(0, my + R * 0.03, R * 0.14, R * (0.03 + k * 0.08)); fill('#7a2840', R * 0.04); break; }
    case 'frown': B(); g.arc(0, my + R * 0.16, R * 0.14, Math.PI + 0.4, -0.4); g.stroke(); break;
    case 'grin': B(); g.moveTo(-R * 0.22, my - R * 0.02); g.quadraticCurveTo(0, my + R * 0.34, R * 0.22, my - R * 0.02); g.closePath(); fill('#7a2840', R * 0.04); B(); ell(0, my + R * 0.12, R * 0.09, R * 0.05); fill('#ff7a8a'); break;
    case 'sleep': B(); ell(0, my + R * 0.04, R * 0.06, R * 0.05 + Math.sin(t * 2) * R * 0.015); fill('#7a2840'); break;
    default: B(); g.arc(0, my - R * 0.02, R * 0.15, 0.25, Math.PI - 0.25); g.stroke();
  }
  if (o.glasses && GLASSES[o.glasses]) GLASSES[o.glasses](R);
  if (o.hat && HATS[o.hat]) HATS[o.hat](R, col);
  // foam
  if (o.foam > 0.02) { const n = Math.round(4 + o.foam * 16); for (let i = 0; i < n; i++) { const a = i * 2.39, d = (0.4 + (i % 5) * 0.12) * R; const bx = Math.cos(a) * d * 1.05, by = Math.sin(a) * d * 0.85 - R * 0.05; B(); ell(bx, by, R * (0.12 + (i % 3) * 0.05), R * (0.12 + (i % 3) * 0.05)); g.fillStyle = 'rgba(255,255,255,.88)'; g.fill(); g.lineWidth = R * 0.02; g.strokeStyle = 'rgba(150,200,240,.8)'; g.stroke(); } }
  g.restore();
}

// ---------------------------------------------------------------- food (drawn)
export const FOODS = [
  { id: 'apple', name: 'Apple', price: 0, food: 14, draw: (s) => { B(); ell(0, s * 0.06, s * 0.42, s * 0.38); fill('#ff4d5e', s * 0.05); B(); g.moveTo(0, -s * 0.28); g.lineTo(s * 0.04, -s * 0.48); g.lineWidth = s * 0.06; g.stroke(); B(); ell(s * 0.16, -s * 0.4, s * 0.14, s * 0.07, -0.4); fill('#5fbf55', s * 0.03); B(); ell(-s * 0.16, -s * 0.1, s * 0.09, s * 0.05, -0.6); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill(); } },
  { id: 'carrot', name: 'Carrot', price: 0, food: 12, draw: (s) => { B(); g.moveTo(-s * 0.16, -s * 0.28); g.quadraticCurveTo(0, s * 0.7, s * 0.16, -s * 0.28); g.closePath(); fill('#ff8a3c', s * 0.05); for (const a of [-0.5, 0, 0.5]) { B(); ell(Math.sin(a) * s * 0.12, -s * 0.38, s * 0.06, s * 0.16, a); fill('#5fbf55', s * 0.03); } } },
  { id: 'sandwich', name: 'Sandwich', price: 4, food: 30, draw: (s) => { B(); g.moveTo(-s * 0.45, s * 0.3); g.lineTo(0, -s * 0.4); g.lineTo(s * 0.45, s * 0.3); g.closePath(); fill('#f6d79a', s * 0.05); B(); g.moveTo(-s * 0.36, s * 0.12); g.lineTo(s * 0.36, s * 0.12); g.lineWidth = s * 0.1; g.strokeStyle = '#7bd06a'; g.stroke(); B(); g.moveTo(-s * 0.3, s * 0.22); g.lineTo(s * 0.3, s * 0.22); g.strokeStyle = '#ff7a8a'; g.stroke(); } },
  { id: 'pizza', name: 'Pizza', price: 7, food: 40, draw: (s) => { B(); g.moveTo(-s * 0.4, -s * 0.3); g.quadraticCurveTo(0, -s * 0.48, s * 0.4, -s * 0.3); g.lineTo(0, s * 0.45); g.closePath(); fill('#ffd36e', s * 0.05); B(); g.moveTo(-s * 0.4, -s * 0.3); g.quadraticCurveTo(0, -s * 0.48, s * 0.4, -s * 0.3); g.lineWidth = s * 0.12; g.strokeStyle = '#d9893a'; g.stroke(); for (const [x, y] of [[-0.12, -0.12], [0.12, -0.05], [0, 0.15]]) { B(); ell(s * x, s * y, s * 0.07, s * 0.07); fill('#e8335c'); } } },
  { id: 'cake', name: 'Cupcake', price: 10, food: 45, fun: 10, draw: (s) => { B(); g.moveTo(-s * 0.3, 0); g.lineTo(-s * 0.22, s * 0.42); g.lineTo(s * 0.22, s * 0.42); g.lineTo(s * 0.3, 0); g.closePath(); fill('#7ad0f0', s * 0.05); B(); ell(0, -s * 0.06, s * 0.36, s * 0.22); ell(0, -s * 0.24, s * 0.22, s * 0.16); fill('#ffc2d6', s * 0.05); B(); ell(0, -s * 0.44, s * 0.08, s * 0.08); fill('#ff4d6d', s * 0.03); } },
  { id: 'soup', name: 'Soup', price: 6, food: 34, draw: (s) => { B(); g.moveTo(-s * 0.45, -s * 0.05); g.quadraticCurveTo(0, s * 0.65, s * 0.45, -s * 0.05); g.closePath(); fill('#ffffff', s * 0.05); B(); ell(0, -s * 0.05, s * 0.45, s * 0.12); fill('#ffb84d', s * 0.05); for (let i = 0; i < 3; i++) { B(); g.moveTo(-s * 0.15 + i * s * 0.15, -s * 0.22); g.quadraticCurveTo(-s * 0.08 + i * s * 0.15, -s * 0.35, -s * 0.15 + i * s * 0.15, -s * 0.48); g.lineWidth = s * 0.04; g.strokeStyle = 'rgba(160,160,180,.6)'; g.stroke(); } } },
];
export function drawFood(ctx, f, x, y, s) { g = ctx; g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round'; f.draw(s); g.restore(); }
export function drawSoap(ctx, x, y, s) { g = ctx; g.save(); g.translate(x, y); g.rotate(-0.15); B(); g.roundRect(-s * 0.45, -s * 0.28, s * 0.9, s * 0.56, s * 0.2); fill('#9ee7ff', s * 0.05); B(); ell(-s * 0.15, -s * 0.12, s * 0.15, s * 0.06, -0.2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); for (const [bx, by, r] of [[0.3, -0.35, 0.1], [0.45, -0.2, 0.07]]) { B(); ell(s * bx, s * by, s * r, s * r); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#9ec9ff'; g.stroke(); } g.restore(); }

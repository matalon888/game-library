// art.js — Spatula Sprint ingredients, burger stacks, customers, grill and kitchen props, drawn with canvas paths.
export const INK = '#3b2a22';
let g;
const B = () => g.beginPath();
const fill = (c, lw = 0) => { g.fillStyle = c; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); } };
const ell = (x, y, rx, ry, r = 0) => { g.moveTo(x + rx * Math.cos(r), y + rx * Math.sin(r)); g.ellipse(x, y, rx, ry, r, 0, Math.PI * 2); };
const lin = (y0, y1, a, b) => { const l = g.createLinearGradient(0, y0, 0, y1); l.addColorStop(0, a); l.addColorStop(1, b); return l; };

// doneness 0..1 → patty colour: raw pink → golden brown → charcoal
export function pattyColor(d) {
  const stops = [[0, [232, 120, 130]], [0.45, [196, 110, 80]], [0.7, [128, 72, 44]], [0.88, [92, 52, 34]], [1, [40, 30, 28]]];
  for (let i = 1; i < stops.length; i++) if (d <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i], k = (d - a) / (b - a); return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`; }
  return 'rgb(40,30,28)';
}
// one layer of a burger, drawn centred at (0,0) with half-width w. Returns its visual height.
export const LAYERS = {
  bun: { name: 'Bun', h: 0.34, draw: (w) => { B(); g.moveTo(-w, -w * 0.12); g.quadraticCurveTo(-w, w * 0.2, -w * 0.8, w * 0.2); g.lineTo(w * 0.8, w * 0.2); g.quadraticCurveTo(w, w * 0.2, w, -w * 0.12); g.closePath(); fill(lin(-w * 0.12, w * 0.2, '#f5c27a', '#d98a3c'), w * 0.06); } },
  top: { name: 'Top Bun', h: 0.62, draw: (w) => { B(); g.moveTo(-w, w * 0.14); g.quadraticCurveTo(-w * 1.02, -w * 0.62, 0, -w * 0.64); g.quadraticCurveTo(w * 1.02, -w * 0.62, w, w * 0.14); g.closePath(); fill(lin(-w * 0.6, w * 0.14, '#f7c983', '#d5822f'), w * 0.06);
    B(); ell(-w * 0.4, -w * 0.38, w * 0.22, w * 0.08, -0.3); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(); for (const [x, y, r] of [[-0.5, -0.2, 0.3], [-0.15, -0.45, -0.2], [0.2, -0.3, 0.5], [0.5, -0.12, -0.4], [0.05, -0.12, 0.1], [-0.3, -0.05, 0.6]]) { B(); ell(w * x, w * y, w * 0.06, w * 0.03, r); g.fillStyle = '#fff6dc'; g.fill(); } } },
  patty: { name: 'Patty', h: 0.3, draw: (w, d = 0.7) => { B(); g.roundRect(-w * 0.95, -w * 0.15, w * 1.9, w * 0.3, w * 0.15); fill(pattyColor(d), w * 0.06); for (let i = 0; i < 6; i++) { B(); ell(-w * 0.7 + i * w * 0.28, -w * 0.02 + (i % 2) * w * 0.06, w * 0.06, w * 0.025); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(); } } },
  cheese: { name: 'Cheese', h: 0.12, draw: (w) => { B(); g.moveTo(-w * 0.98, -w * 0.06); g.lineTo(w * 0.98, -w * 0.06); g.lineTo(w * 0.9, w * 0.06); g.lineTo(w * 0.55, w * 0.06); g.lineTo(w * 0.45, w * 0.3); g.lineTo(w * 0.35, w * 0.06); g.lineTo(-w * 0.3, w * 0.06); g.lineTo(-w * 0.42, w * 0.24); g.lineTo(-w * 0.55, w * 0.06); g.lineTo(-w * 0.9, w * 0.06); g.closePath(); fill('#ffcc33', w * 0.05); } },
  lettuce: { name: 'Lettuce', h: 0.14, draw: (w) => { B(); g.moveTo(-w * 1.05, 0); for (let i = 0; i <= 12; i++) { const x = -w * 1.05 + i * w * 2.1 / 12; g.quadraticCurveTo(x - w * 0.09, (i % 2 ? w * 0.16 : -w * 0.1), x, i % 2 ? w * 0.04 : -w * 0.04); } g.lineTo(w * 0.9, -w * 0.08); g.lineTo(-w * 0.9, -w * 0.08); g.closePath(); fill('#7fd35a', w * 0.05); } },
  tomato: { name: 'Tomato', h: 0.13, draw: (w) => { for (const x of [-0.5, 0.5]) { B(); g.roundRect(w * x - w * 0.48, -w * 0.07, w * 0.96, w * 0.14, w * 0.07); fill('#ef4a4a', w * 0.05); B(); ell(w * x, 0, w * 0.28, w * 0.03); g.fillStyle = '#ffb0a0'; g.fill(); } } },
  onion: { name: 'Onion', h: 0.1, draw: (w) => { for (const x of [-0.55, 0, 0.55]) { B(); ell(w * x, 0, w * 0.34, w * 0.07); g.lineWidth = w * 0.06; g.strokeStyle = '#d7b8e8'; g.stroke(); g.lineWidth = w * 0.025; g.strokeStyle = INK; g.stroke(); } } },
  pickles: { name: 'Pickles', h: 0.1, draw: (w) => { for (const x of [-0.6, -0.2, 0.2, 0.6]) { B(); ell(w * x, 0, w * 0.2, w * 0.06); fill('#5aa03a', w * 0.04); B(); ell(w * x, 0, w * 0.1, w * 0.025); g.fillStyle = '#a8d878'; g.fill(); } } },
  ketchup: { name: 'Ketchup', h: 0.07, draw: (w) => { B(); g.moveTo(-w * 0.85, 0); for (let i = 0; i <= 10; i++) g.lineTo(-w * 0.85 + i * w * 0.17, (i % 2 ? 1 : -1) * w * 0.05); g.lineWidth = w * 0.1; g.strokeStyle = '#d6232a'; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); } },
  mustard: { name: 'Mustard', h: 0.07, draw: (w) => { B(); g.moveTo(-w * 0.85, 0); for (let i = 0; i <= 10; i++) g.lineTo(-w * 0.85 + i * w * 0.17, (i % 2 ? -1 : 1) * w * 0.05); g.lineWidth = w * 0.1; g.strokeStyle = '#f2c21f'; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); } },
};
/** draw a burger stack bottom-up. layers: [{k, d?}], base y is the bottom of the stack */
export function drawStack(ctx, layers, x, y, w, drop = null) {
  g = ctx; g.save(); g.translate(x, y); let yy = 0;
  layers.forEach((L, i) => { const def = LAYERS[L.k]; const hh = def.h * w; g.save(); let off = 0; if (drop && i === layers.length - 1) off = -drop * 60; g.translate(0, yy - hh / 2 + off); def.draw(w, L.d); g.restore(); yy -= hh * 0.78; });
  g.restore(); return -yy;
}
export function drawLayerIcon(ctx, k, x, y, w) { g = ctx; g.save(); g.translate(x, y); LAYERS[k].draw(w, 0.72); g.restore(); }

export function drawCup(ctx, x, y, s, fillLvl = 1) {
  g = ctx; g.save(); g.translate(x, y);
  B(); g.moveTo(-s * 0.36, -s * 0.5); g.lineTo(-s * 0.28, s * 0.5); g.lineTo(s * 0.28, s * 0.5); g.lineTo(s * 0.36, -s * 0.5); g.closePath(); fill('#ffffff', s * 0.05);
  g.save(); g.clip(); g.fillStyle = '#e8463c'; g.fillRect(-s, s * 0.5 - s * fillLvl, s * 2, s * fillLvl); g.restore();
  B(); g.moveTo(-s * 0.36, -s * 0.5); g.lineTo(-s * 0.28, s * 0.5); g.lineTo(s * 0.28, s * 0.5); g.lineTo(s * 0.36, -s * 0.5); g.closePath(); g.lineWidth = s * 0.05; g.strokeStyle = INK; g.stroke();
  if (fillLvl >= 1) { B(); g.roundRect(-s * 0.4, -s * 0.6, s * 0.8, s * 0.14, s * 0.06); fill('#ffffff', s * 0.04); B(); g.moveTo(s * 0.1, -s * 0.6); g.lineTo(s * 0.22, -s * 0.9); g.lineWidth = s * 0.08; g.strokeStyle = '#3fa9f5'; g.stroke(); }
  B(); g.rect(-s * 0.32, -s * 0.1, s * 0.64, s * 0.2); g.fillStyle = 'rgba(255,214,90,.9)'; g.fill();
  g.restore();
}

// ---------------------------------------------------------------- customers (original folks)
export const FOLKS = [
  { skin: '#f6c7a1', hair: '#3a2418', style: 'short', top: '#ff7a5c' }, { skin: '#c98c5c', hair: '#1d1410', style: 'afro', top: '#3fa9f5' },
  { skin: '#ffe0c8', hair: '#f2b53c', style: 'pony', top: '#9b7bff' }, { skin: '#8d5a3b', hair: '#2a1a12', style: 'bun', top: '#52b788' },
  { skin: '#f1c3a0', hair: '#c7c7cf', style: 'bald', top: '#ffb72e', glasses: true }, { skin: '#e9b08a', hair: '#7a3e1d', style: 'cap', top: '#ff5d8f' },
  { skin: '#ffd9c0', hair: '#e85d3a', style: 'pony', top: '#2a9d8f' }, { skin: '#a8714d', hair: '#120c08', style: 'short', top: '#7b5cff', glasses: true },
];
export function drawFolk(ctx, f, x, y, s, mood) {   // mood: 1 happy, 0 ok, -1 cross
  g = ctx; g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
  B(); g.moveTo(-s * 1.1, s * 2.2); g.quadraticCurveTo(-s * 1.1, s * 0.9, 0, s * 0.9); g.quadraticCurveTo(s * 1.1, s * 0.9, s * 1.1, s * 2.2); g.closePath(); fill(f.top, s * 0.08);
  if (f.style === 'afro') { B(); ell(0, -s * 0.2, s * 1.25, s * 1.15); fill(f.hair, s * 0.08); }
  if (f.style === 'pony') { B(); ell(s * 0.95, s * 0.1, s * 0.3, s * 0.6, -0.3); fill(f.hair, s * 0.08); }
  if (f.style === 'bun') { B(); ell(0, -s * 1.1, s * 0.4, s * 0.38); fill(f.hair, s * 0.08); }
  B(); ell(0, 0, s, s); fill(f.skin, s * 0.08);
  if (f.style === 'short' || f.style === 'pony' || f.style === 'bun') { B(); g.moveTo(-s, s * 0.05); g.quadraticCurveTo(-s, -s * 1.15, 0, -s * 1.08); g.quadraticCurveTo(s, -s * 1.15, s, s * 0.05); g.quadraticCurveTo(s * 0.4, -s * 0.6, -s, s * 0.05); fill(f.hair, s * 0.08); }
  if (f.style === 'cap') { B(); g.moveTo(-s, -s * 0.15); g.quadraticCurveTo(0, -s * 1.6, s, -s * 0.15); g.closePath(); fill('#ff5d8f', s * 0.08); B(); g.roundRect(-s * 0.2, -s * 0.32, s * 1.5, s * 0.22, s * 0.1); fill('#ff5d8f', s * 0.08); }
  if (f.style === 'bald') { B(); ell(-s * 0.9, -s * 0.1, s * 0.22, s * 0.35); ell(s * 0.9, -s * 0.1, s * 0.22, s * 0.35); fill(f.hair, s * 0.06); }
  const ey = -s * 0.05;
  for (const ex of [-0.36, 0.36]) { if (mood > 0) { B(); g.arc(ex * s, ey + s * 0.05, s * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = s * 0.08; g.strokeStyle = INK; g.stroke(); } else { B(); ell(ex * s, ey, s * 0.11, s * 0.13); fill(INK); } }
  if (mood < 0) for (const ex of [-1, 1]) { B(); g.moveTo(ex * s * 0.15, -s * 0.32); g.lineTo(ex * s * 0.55, -s * 0.42); g.lineWidth = s * 0.08; g.strokeStyle = INK; g.stroke(); }
  if (f.glasses) { g.lineWidth = s * 0.06; g.strokeStyle = INK; B(); ell(-0.36 * s, ey, s * 0.24, s * 0.22); ell(0.36 * s, ey, s * 0.24, s * 0.22); g.stroke(); }
  B(); ell(-s * 0.62, s * 0.32, s * 0.15, s * 0.1); ell(s * 0.62, s * 0.32, s * 0.15, s * 0.1); g.fillStyle = 'rgba(255,100,120,.35)'; g.fill();
  B(); if (mood > 0) { g.moveTo(-s * 0.3, s * 0.3); g.quadraticCurveTo(0, s * 0.8, s * 0.3, s * 0.3); g.closePath(); fill('#c94a5a', s * 0.06); }
  else if (mood < 0) { g.arc(0, s * 0.62, s * 0.22, Math.PI + 0.5, -0.5); g.lineWidth = s * 0.08; g.strokeStyle = INK; g.stroke(); }
  else { g.moveTo(-s * 0.2, s * 0.4); g.lineTo(s * 0.2, s * 0.4); g.lineWidth = s * 0.08; g.strokeStyle = INK; g.stroke(); }
  g.restore();
}

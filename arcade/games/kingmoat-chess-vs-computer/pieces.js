// pieces.js — Kingmoat's own chess piece silhouettes (100 × 100 units), drawn in code. Our own art, MIT.
const BASE = 'M24 80h52a4 4 0 0 1 4 4v3a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3v-3a4 4 0 0 1 4-4Z';
const COLLAR = 'M30 64h40a3 3 0 0 1 0 6H30a3 3 0 0 1 0-6Z';
const SKIRT = 'M34 72h32l5 6H29Z';
export const PATHS = {
  1: 'M50 17a13 13 0 1 1 0 26a13 13 0 1 1 0-26Z M37 47h26a3 3 0 0 1 0 6h-3c0 10 3 18 9 25H31c6-7 9-15 9-25h-3a3 3 0 0 1 0-6Z ' + BASE,
  2: 'M74 78H30c0-12 4-19 12-26-5 1-10 4-14 3-5-1-7-6-5-10l14-17c1-5 3-9 7-12l1-6 5 6c13 3 22 14 24 30 1 11-1 22 0 32Z ' + BASE,
  3: 'M50 9a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M50 21c10 8 17 17 17 26 0 8-7 13-17 13s-17-5-17-13c0-9 7-18 17-26Z M36 62h28a3 3 0 0 1 0 6H36a3 3 0 0 1 0-6Z M40 69h20c1 4 4 7 8 9H32c4-2 7-5 8-9Z ' + BASE,
  4: 'M27 13h10v7h7v-7h12v7h7v-7h10v17l-6 5H33l-6-5Z M35 38h30l2 32H33Z M29 72h42a3 3 0 0 1 3 3v3H26v-3a3 3 0 0 1 3-3Z ' + BASE,
  5: 'M22 21a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M36 13a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M50 9a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M64 13a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M78 21a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z M22 33L31 62H69L78 33L68 47L64 25L57 43L50 21L43 43L36 25L32 47Z ' + COLLAR + ' ' + SKIRT + ' ' + BASE,
  6: 'M47 5h6v6h6v6h-6v7h-6v-7h-6v-6h6Z M50 26c-11 0-21 4-25 11-4 7 0 16 5 25h40c5-9 9-18 5-25-4-7-14-11-25-11Z ' + COLLAR + ' ' + SKIRT + ' ' + BASE,
};
export const DETAIL = {   // inner lines drawn on top (bishop slit, knight eye + mane, king band)
  2: 'M41 31a2.6 2.6 0 1 1 0.1 0Z',
  3: 'M56 31L46 44',
  6: 'M32 47c12-5 24-5 36 0',
};
const cache = {};
const p2d = (k, d) => (cache[k] = cache[k] || new Path2D(d));
export const LOOK = {
  w: { a: '#fffdf8', b: '#e4d8c4', line: '#3b3247', det: '#3b3247' },
  b: { a: '#625874', b: '#2a2333', line: '#1b1622', det: '#d9cfe8' },
};
/** draw a piece (abs type 1..6, white = true) centred at x,y with size s */
export function drawPiece(g, type, white, x, y, s, { alpha = 1, lift = 0, shadow = true } = {}) {
  const L = white ? LOOK.w : LOOK.b, k = s / 100;
  g.save(); g.globalAlpha = alpha; g.translate(x - s / 2, y - s / 2 - lift); g.scale(k, k);
  if (shadow) { g.fillStyle = `rgba(30,25,40,${0.22 * alpha})`; g.beginPath(); g.ellipse(50, 88 + lift / k, 30 - lift / k * 0.2, 6, 0, 0, 7); g.fill(); }
  const gr = g.createLinearGradient(20, 10, 80, 92); gr.addColorStop(0, L.a); gr.addColorStop(1, L.b);
  const path = p2d('p' + type, PATHS[type]);
  g.fillStyle = gr; g.fill(path);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = L.line; g.lineWidth = 3.4; g.stroke(path);
  if (DETAIL[type]) {
    const d = p2d('d' + type, DETAIL[type]); g.strokeStyle = L.det; g.lineWidth = 2.6;
    if (type === 2) { g.fillStyle = L.det; g.fill(d); } else g.stroke(d);
  }
  // soft top highlight
  g.globalAlpha = alpha * (white ? 0.5 : 0.22); g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(36, 84); g.lineTo(62, 84); g.stroke();
  g.restore();
}
/** tiny inline SVG for the captured-pieces rows */
export function pieceSvg(type, white, size = 18) {
  const L = white ? LOOK.w : LOOK.b;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="margin:0 -3px"><path d="${PATHS[type]}" fill="${white ? '#fbf6ec' : '#3a3245'}" stroke="${L.line}" stroke-width="5" stroke-linejoin="round"/></svg>`;
}

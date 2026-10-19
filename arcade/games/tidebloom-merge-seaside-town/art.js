// art.js — every Tidebloom item, generator, villager and town building, drawn with canvas paths (no images).
// Items are drawn in a -50..50 box, then cached as bitmaps per size.
const INK = '#4b3527';
let g;   // current context

const B = () => g.beginPath();
const fill = (c, stroke = true, lw = 4) => { g.fillStyle = c; g.fill(); if (stroke) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); } };
const circ = (x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); };
const ell = (x, y, rx, ry, rot = 0) => { g.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
const rr = (x, y, w, h, r) => { g.roundRect(x, y, w, h, r); };
const lin = (x0, y0, x1, y1, stops) => { const l = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => l.addColorStop(i / (stops.length - 1), c)); return l; };
const rad = (x, y, r, a, b) => { const l = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r); l.addColorStop(0, a); l.addColorStop(1, b); return l; };
const shine = (x, y, rx, ry, rot = -0.5, a = 0.55) => { B(); ell(x, y, rx, ry, rot); g.fillStyle = `rgba(255,255,255,${a})`; g.fill(); };
const line = (pts, c = INK, w = 4) => { B(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); };
const shadow = (y = 40, rx = 30) => { B(); ell(0, y, rx, rx * 0.22); g.fillStyle = 'rgba(60,40,20,.18)'; g.fill(); };
function fan(cx, cy, r, c1, c2, ribs = 7, ears = false) {
  if (ears) { B(); g.moveTo(cx - 10, cy); g.lineTo(cx - 18, cy + 8); g.lineTo(cx - 4, cy + 10); g.closePath(); g.moveTo(cx + 10, cy); g.lineTo(cx + 18, cy + 8); g.lineTo(cx + 4, cy + 10); g.closePath(); fill(c2); }
  B(); g.moveTo(cx, cy + 6);
  const n = ribs * 2; for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI, rr2 = i % 2 ? r : r * 0.93; g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2 * 0.95); }
  g.closePath(); fill(rad(cx, cy - r * 0.5, r, c1, c2));
  for (let i = 1; i < ribs; i++) { const a = Math.PI + (i / ribs) * Math.PI; line([[cx, cy + 4], [cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.86]], 'rgba(75,53,39,.35)', 2.5); }
  shine(cx - r * 0.35, cy - r * 0.55, r * 0.18, r * 0.09);
}
function star(cx, cy, r, c, pts = 5, inner = 0.45, stroke = true) { B(); for (let i = 0; i < pts * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / pts, q = i % 2 ? r * inner : r; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); fill(c, stroke, 3); }
function leaf(x, y, len, w, rot, c) { g.save(); g.translate(x, y); g.rotate(rot); B(); g.moveTo(0, 0); g.quadraticCurveTo(w, -len * 0.5, 0, -len); g.quadraticCurveTo(-w, -len * 0.5, 0, 0); fill(c, true, 3); line([[0, -2], [0, -len * 0.8]], 'rgba(40,80,30,.35)', 2); g.restore(); }
function flower(x, y, r, petal, mid = '#ffd84a', n = 6) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; B(); ell(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, r * 0.32, a); fill(petal, true, 2.5); } B(); circ(x, y, r * 0.38); fill(mid, true, 2.5); }
function glass(x, y, w, h, liquid, lvl = 0.75) {
  B(); g.moveTo(x - w / 2, y - h / 2); g.lineTo(x - w * 0.38, y + h / 2); g.lineTo(x + w * 0.38, y + h / 2); g.lineTo(x + w / 2, y - h / 2); g.closePath(); fill('rgba(220,245,255,.75)');
  g.save(); B(); g.moveTo(x - w / 2, y - h / 2); g.lineTo(x - w * 0.38, y + h / 2); g.lineTo(x + w * 0.38, y + h / 2); g.lineTo(x + w / 2, y - h / 2); g.closePath(); g.clip();
  g.fillStyle = liquid; g.fillRect(x - w, y + h / 2 - h * lvl, w * 2, h); g.restore();
  B(); g.moveTo(x - w / 2, y - h / 2); g.lineTo(x - w * 0.38, y + h / 2); g.lineTo(x + w * 0.38, y + h / 2); g.lineTo(x + w / 2, y - h / 2); g.closePath(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  shine(x - w * 0.28, y - h * 0.05, 3, h * 0.3, 0.1, 0.6);
}
function coin(x, y, r) { B(); circ(x, y, r); fill(rad(x, y, r, '#fff3a0', '#f2b81f'), true, 3); B(); circ(x, y, r * 0.6); g.strokeStyle = 'rgba(160,100,10,.5)'; g.lineWidth = 2; g.stroke(); }
function gem(x, y, r, c) { B(); g.moveTo(x, y - r); g.lineTo(x + r, y - r * 0.2); g.lineTo(x, y + r); g.lineTo(x - r, y - r * 0.2); g.closePath(); fill(c, true, 3); shine(x - r * 0.3, y - r * 0.35, r * 0.25, r * 0.12); }

// ---------------------------------------------------------------- chains (9 tiers each)
export const CHAINS = {
  sea: {
    gen: 'Tide Pool', color: '#5fc8e8', names: ['Pebble', 'Cockle', 'Scallop', 'Conch', 'Pearl Clam', 'Pearl String', 'Coral', 'Jewel Box', 'Sunken Chest'],
    draw: [
      () => { shadow(30, 28); B(); ell(0, 6, 34, 24, -0.15); fill(rad(0, 6, 36, '#d9e4ec', '#93a6b8')); for (const [x, y] of [[-12, 0], [8, 12], [14, -4], [-2, 16]]) { B(); circ(x, y, 3); g.fillStyle = 'rgba(70,90,110,.35)'; g.fill(); } shine(-12, -6, 10, 5); },
      () => { shadow(34, 26); fan(0, 22, 36, '#fff4dc', '#f5c99a', 6); },
      () => { shadow(36, 30); fan(0, 22, 42, '#ffd6e4', '#f28aa9', 8, true); },
      () => { shadow(38, 30); B(); g.moveTo(-34, 10); g.quadraticCurveTo(-30, -34, 8, -38); g.quadraticCurveTo(40, -30, 36, 4); g.quadraticCurveTo(20, 34, -10, 36); g.quadraticCurveTo(-30, 30, -34, 10); fill(rad(0, -4, 40, '#ffe3c6', '#f39a6b'));
        B(); g.moveTo(-34, 10); g.quadraticCurveTo(-6, 14, 10, 30); g.quadraticCurveTo(-20, 34, -34, 10); fill('#ffb3c1', true, 3);
        g.lineWidth = 3; g.strokeStyle = 'rgba(120,60,30,.5)'; B(); g.arc(10, -8, 18, -2.6, 1.2); g.stroke(); B(); g.arc(10, -8, 9, -2.2, 2.2); g.stroke(); for (const a of [-1.9, -1.2, -0.5]) { B(); g.moveTo(10 + Math.cos(a) * 26, -8 + Math.sin(a) * 26); g.lineTo(10 + Math.cos(a) * 36, -8 + Math.sin(a) * 34); g.stroke(); } shine(-14, -16, 9, 4); },
      () => { shadow(38, 34); B(); g.moveTo(-38, 14); g.quadraticCurveTo(0, 46, 38, 14); g.quadraticCurveTo(0, 22, -38, 14); fill('#c9a6e8');
        B(); g.moveTo(-38, 14); g.quadraticCurveTo(-40, -36, 0, -38); g.quadraticCurveTo(40, -36, 38, 14); g.quadraticCurveTo(0, 2, -38, 14); fill(lin(0, -38, 0, 14, ['#e7d4ff', '#a987d9']));
        B(); ell(0, 16, 30, 9); fill('#7a5aa8', true, 3); B(); circ(0, 10, 13); fill(rad(0, 10, 13, '#ffffff', '#d9d4e8'), true, 3); shine(-4, 5, 4, 3, 0, 0.9); },
      () => { shadow(36, 32); g.lineWidth = 3; g.strokeStyle = '#c2a36b'; B(); g.arc(0, -16, 34, 0.25, Math.PI - 0.25); g.stroke();
        for (let i = 0; i <= 10; i++) { const a = 0.25 + (Math.PI - 0.5) * i / 10; const x = Math.cos(a) * 34, y = -16 + Math.sin(a) * 34; B(); circ(x, y, i === 5 ? 10 : 7); fill(rad(x, y, 9, '#ffffff', i === 5 ? '#ffc9de' : '#dedbea'), true, 2.5); } },
      () => { shadow(40, 32); B(); ell(0, 32, 30, 10); fill('#b0a090', true, 3);
        g.lineCap = 'round'; for (const [w, c] of [[16, INK], [10, '#ff6f7d']]) { g.lineWidth = w; g.strokeStyle = c; B(); g.moveTo(0, 30); g.lineTo(0, 0); g.lineTo(-18, -22); g.moveTo(0, 0); g.lineTo(16, -20); g.lineTo(26, -36); g.moveTo(-18, -22); g.lineTo(-30, -18); g.moveTo(-18, -22); g.lineTo(-14, -40); g.moveTo(16, -20); g.lineTo(4, -38); g.moveTo(0, 12); g.lineTo(-26, 6); g.stroke(); }
        for (const [x, y] of [[-6, -10], [10, -26], [-20, -30]]) { B(); circ(x, y, 2.5); g.fillStyle = '#fff'; g.fill(); } },
      () => { shadow(38, 36); B(); rr(-36, -6, 72, 40, 8); fill(lin(0, -6, 0, 34, ['#48c6c0', '#1f8f9c'])); B(); g.moveTo(-36, -4); g.quadraticCurveTo(-36, -34, 0, -34); g.quadraticCurveTo(36, -34, 36, -4); g.closePath(); fill(lin(0, -34, 0, -4, ['#6fe0d6', '#2aa6ad']));
        line([[-36, 12], [36, 12]], '#f2c94c', 5); B(); rr(-9, 2, 18, 18, 4); fill('#f2c94c', true, 3); gem(0, -20, 10, '#ff5d8f'); gem(-20, -14, 5, '#ffd23f'); gem(20, -14, 5, '#7b5cff'); shine(-22, -26, 8, 3); },
      () => { shadow(40, 40); coin(-30, 30, 8); coin(30, 32, 7); B(); rr(-40, -2, 80, 38, 6); fill(lin(0, -2, 0, 36, ['#c27a3e', '#8a4f25']));
        B(); g.moveTo(-40, 0); g.quadraticCurveTo(-40, -30, 0, -30); g.quadraticCurveTo(40, -30, 40, 0); g.closePath(); fill(lin(0, -30, 0, 0, ['#d99155', '#a25e2c']));
        for (const x of [-26, 26]) { B(); rr(x - 5, -28, 10, 64, 3); fill('#f2c94c', true, 3); } line([[-40, 0], [40, 0]], INK, 4); B(); rr(-8, -6, 16, 16, 3); fill('#ffe37a', true, 3);
        coin(-10, -36, 8); coin(6, -40, 8); gem(18, -32, 7, '#4fd1ff'); gem(-22, -30, 6, '#ff5d8f'); coin(-14, 30, 7); },
    ],
  },
  bake: {
    gen: 'Brick Oven', color: '#f2a65a', names: ['Wheat', 'Flour Sack', 'Dough', 'Sesame Bun', 'Croissant', 'Bread Basket', 'Cupcake', 'Berry Pie', 'Party Cake'],
    draw: [
      () => { shadow(40, 20); line([[0, 40], [0, -20]], '#c79b3b', 5); for (let i = 0; i < 5; i++) { const y = -32 + i * 11; B(); ell(-8, y, 6, 11, -0.6); fill('#f5cd5b', true, 3); B(); ell(8, y, 6, 11, 0.6); fill('#f5cd5b', true, 3); } B(); ell(0, -40, 5, 10); fill('#f8d870', true, 3); },
      () => { shadow(38, 32); B(); g.moveTo(-28, -18); g.quadraticCurveTo(-38, 20, -26, 36); g.lineTo(26, 36); g.quadraticCurveTo(38, 20, 28, -18); g.quadraticCurveTo(0, -12, -28, -18); fill(lin(0, -18, 0, 36, ['#fbf3e2', '#ddc8a4']));
        B(); g.moveTo(-28, -18); g.lineTo(-20, -34); g.lineTo(0, -26); g.lineTo(20, -34); g.lineTo(28, -18); g.closePath(); fill('#f1e3c6'); line([[-20, -16], [20, -16]], '#d76a5a', 6); B(); ell(0, 12, 12, 10); fill('#f5cd5b', true, 3); line([[-4, 4], [-4, 20]], INK, 2); line([[4, 4], [4, 20]], INK, 2); },
      () => { shadow(36, 34); B(); g.moveTo(-36, 26); g.quadraticCurveTo(-40, -10, -10, -24); g.quadraticCurveTo(20, -36, 34, -4); g.quadraticCurveTo(44, 24, 20, 30); g.closePath(); fill(rad(0, 0, 40, '#fff7e8', '#efd3a8')); shine(-14, -10, 12, 6); B(); circ(16, 6, 3); g.fillStyle = 'rgba(160,120,70,.4)'; g.fill(); },
      () => { shadow(34, 34); B(); g.moveTo(-38, 20); g.quadraticCurveTo(-40, -30, 0, -32); g.quadraticCurveTo(40, -30, 38, 20); g.closePath(); fill(rad(0, -10, 44, '#ffcf7a', '#d98a2b')); B(); rr(-38, 18, 76, 12, 6); fill('#f7d9a0', true, 3);
        for (const [x, y, r] of [[-14, -18, 0.3], [6, -22, -0.2], [18, -8, 0.6], [-4, -6, -0.4], [-22, -2, 0.2]]) { B(); ell(x, y, 3.5, 2, r); g.fillStyle = '#fff6dd'; g.fill(); } shine(-16, -18, 10, 4); },
      () => { shadow(34, 38); const seg = [[-30, 10, 12, 0.7], [-16, -4, 15, 0.35], [0, -10, 17, 0], [16, -4, 15, -0.35], [30, 10, 12, -0.7]];
        for (const [x, y, r, a] of seg) { B(); ell(x, y, r * 0.75, r, a); fill(rad(x, y, r, '#ffd38a', '#d9862e'), true, 3.5); } shine(-2, -18, 7, 3, 0); },
      () => { shadow(38, 38); for (const [x, a] of [[-12, -0.35], [12, 0.3]]) { g.save(); g.translate(x, -6); g.rotate(a); B(); rr(-9, -34, 18, 56, 9); fill(lin(-9, 0, 9, 0, ['#f0b25b', '#c87a26'])); for (let k = -24; k < 16; k += 11) line([[-5, k + 4], [5, k - 2]], '#fff0cc', 2.5); g.restore(); }
        B(); g.moveTo(-36, 6); g.lineTo(-28, 36); g.lineTo(28, 36); g.lineTo(36, 6); g.closePath(); fill(lin(0, 6, 0, 36, ['#d39a5e', '#a86a33'])); for (let k = -24; k <= 24; k += 12) line([[k, 8], [k * 0.8, 34]], 'rgba(75,53,39,.4)', 2.5); line([[-34, 18], [34, 18]], 'rgba(75,53,39,.4)', 2.5); },
      () => { shadow(40, 26); B(); g.moveTo(-26, 0); g.lineTo(-18, 38); g.lineTo(18, 38); g.lineTo(26, 0); g.closePath(); fill(lin(0, 0, 0, 38, ['#7ad0f0', '#3f9fd0'])); for (let k = -16; k <= 16; k += 8) line([[k, 4], [k * 0.75, 36]], 'rgba(255,255,255,.5)', 2.5);
        B(); g.moveTo(-30, 2); g.quadraticCurveTo(-36, -16, -18, -18); g.quadraticCurveTo(-16, -36, 0, -32); g.quadraticCurveTo(16, -40, 18, -20); g.quadraticCurveTo(36, -16, 30, 2); g.closePath(); fill(rad(0, -14, 34, '#ffffff', '#ffc2d6'));
        B(); circ(4, -38, 8); fill('#ff4d6d', true, 3); line([[6, -46], [12, -54]], INK, 3); shine(1, -41, 3, 2, 0, 0.8); for (const [x, y, c] of [[-14, -8, '#ffd23f'], [12, -10, '#7b5cff'], [0, -20, '#3ab795']]) { B(); ell(x, y, 3, 1.5, 0.6); g.fillStyle = c; g.fill(); } },
      () => { shadow(30, 42); B(); ell(0, 14, 42, 20); fill('#b9bec6'); B(); ell(0, 6, 38, 18); fill(lin(0, -12, 0, 24, ['#f6c27a', '#d9893a'])); g.save(); B(); ell(0, 6, 30, 13); g.clip(); g.fillStyle = '#c4285e'; g.fillRect(-40, -20, 80, 40);
        g.strokeStyle = '#f6c27a'; g.lineWidth = 4; for (let k = -28; k <= 28; k += 14) { B(); g.moveTo(k, -14); g.lineTo(k + 10, 24); g.stroke(); B(); g.moveTo(-36, k * 0.45 + 4); g.lineTo(36, k * 0.45 + 2); g.stroke(); } g.restore(); B(); ell(0, 6, 30, 13); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); shine(-18, -2, 8, 3); },
      () => { shadow(42, 40); const tiers = [[0, 22, 40, 20, '#ffd6e4'], [0, 0, 30, 20, '#fff3c4'], [0, -20, 20, 18, '#cdeefe']];
        for (const [x, y, w, h, c] of tiers) { B(); rr(x - w, y - h / 2, w * 2, h, 6); fill(c, true, 3.5); B(); g.moveTo(x - w, y - h / 2 + 4); for (let k = 0; k <= 8; k++) g.lineTo(x - w + k * w / 4, y - h / 2 + (k % 2 ? 10 : 4)); g.strokeStyle = '#ff7aa2'; g.lineWidth = 3; g.stroke(); }
        for (const x of [-10, 0, 10]) { B(); rr(x - 2.5, -42, 5, 14, 2); fill('#7b5cff', true, 2); B(); ell(x, -46, 3, 5); g.fillStyle = '#ffb300'; g.fill(); } B(); circ(-20, 4, 3); g.fillStyle = '#ff4d6d'; g.fill(); B(); circ(18, 2, 3); g.fill(); },
    ],
  },
  garden: {
    gen: 'Seed Crate', color: '#7bcf6a', names: ['Seed', 'Sprout', 'Tulip', 'Daisy Bunch', 'Flower Pot', 'Berry Bush', 'Sunflower', 'Palm', 'Orange Tree'],
    draw: [
      () => { shadow(30, 20); B(); g.moveTo(0, -30); g.quadraticCurveTo(26, 0, 14, 22); g.quadraticCurveTo(0, 34, -14, 22); g.quadraticCurveTo(-26, 0, 0, -30); fill(rad(0, 4, 30, '#d7a46a', '#8f5c2c')); line([[0, -18], [0, 20]], 'rgba(75,53,39,.35)', 3); shine(-7, -4, 4, 8, 0.2); },
      () => { shadow(34, 30); B(); ell(0, 30, 32, 12); fill('#9a6a3e'); line([[0, 26], [0, -6]], '#4f9a3a', 5); leaf(0, -4, 30, 14, -1.0, '#7bd06a'); leaf(0, -4, 30, 14, 1.0, '#68c25a'); },
      () => { shadow(40, 18); line([[0, 40], [0, -6]], '#3f8f37', 5); leaf(0, 36, 34, 10, -0.5, '#6cc35d'); B(); g.moveTo(-18, -30); g.lineTo(-10, -18); g.lineTo(0, -32); g.lineTo(10, -18); g.lineTo(18, -30); g.quadraticCurveTo(22, 0, 0, 2); g.quadraticCurveTo(-22, 0, -18, -30); fill(rad(0, -14, 24, '#ff9ab6', '#e83f6f')); shine(-8, -16, 3, 7, 0.2); },
      () => { shadow(40, 30); for (const [x, a] of [[-14, -0.4], [0, 0], [14, 0.4]]) line([[0, 40], [x * 1.6, -6 + Math.abs(x)]], '#3f8f37', 4); leaf(0, 34, 26, 10, -0.9, '#6cc35d'); leaf(0, 34, 26, 10, 0.9, '#6cc35d');
        flower(-22, -10, 15, '#ffffff'); flower(22, -12, 15, '#ffffff'); flower(0, -24, 17, '#fff4f8', '#ffb72e'); },
      () => { shadow(42, 30); flower(-14, -26, 13, '#ff8fb3'); flower(14, -28, 13, '#b48cff'); flower(0, -38, 13, '#ffd84a', '#ff8a3c'); leaf(-4, 0, 26, 10, -0.8, '#5fbf55'); leaf(4, 0, 26, 10, 0.8, '#5fbf55');
        B(); g.moveTo(-26, -2); g.lineTo(26, -2); g.lineTo(20, 40); g.lineTo(-20, 40); g.closePath(); fill(lin(0, 0, 0, 40, ['#e98a5a', '#b9582f'])); B(); rr(-30, -8, 60, 12, 4); fill('#f2a074', true, 3.5); },
      () => { shadow(40, 40); for (const [x, y, r] of [[-20, 8, 22], [20, 8, 22], [0, -12, 26], [-6, 16, 22], [12, 16, 20]]) { B(); circ(x, y, r); fill(rad(x, y, r, '#8fe07a', '#3f9a3e'), true, 3.5); }
        for (const [x, y] of [[-18, 0], [10, -14], [22, 10], [-4, 18], [-6, -20], [6, 6]]) { B(); circ(x, y, 4.5); fill('#e8335c', true, 2); B(); circ(x - 1.5, y - 1.5, 1.4); g.fillStyle = '#fff'; g.fill(); } },
      () => { shadow(44, 22); line([[0, 44], [0, -4]], '#3f8f37', 6); leaf(0, 30, 28, 12, -1.1, '#5fbf55'); leaf(0, 22, 28, 12, 1.1, '#5fbf55');
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; B(); ell(Math.cos(a) * 20, -22 + Math.sin(a) * 20, 10, 5, a); fill('#ffcc1f', true, 2.5); } B(); circ(0, -22, 14); fill(rad(0, -22, 14, '#9a5a2a', '#5e3417'), true, 3); },
      () => { shadow(44, 30); B(); g.moveTo(-6, 44); g.quadraticCurveTo(-2, 0, 6, -24); g.lineTo(12, -24); g.quadraticCurveTo(8, 0, 8, 44); g.closePath(); fill(lin(-6, 0, 12, 0, ['#c99257', '#8f5c2c'])); for (let y = 30; y > -20; y -= 9) line([[-5 + (30 - y) * 0.1, y], [7 + (30 - y) * 0.12, y - 2]], 'rgba(75,53,39,.4)', 2);
        for (const a of [-2.8, -2.1, -1.4, -0.7, -0.1]) { g.save(); g.translate(9, -26); g.rotate(a + Math.PI / 2); B(); g.moveTo(0, 0); g.quadraticCurveTo(14, -18, 4, -44); g.quadraticCurveTo(-6, -20, 0, 0); fill('#4fc35a', true, 3); g.restore(); }
        for (const [x, y] of [[4, -22], [14, -20]]) { B(); circ(x, y, 5); fill('#8a5a2c', true, 2.5); } },
      () => { shadow(44, 34); B(); g.moveTo(-6, 44); g.lineTo(-4, 4); g.lineTo(4, 4); g.lineTo(6, 44); g.closePath(); fill('#9a6634');
        for (const [x, y, r] of [[-20, -6, 20], [20, -6, 20], [0, -24, 24], [0, 0, 22]]) { B(); circ(x, y, r); fill(rad(x, y, r, '#7fd66b', '#2f8a3a'), true, 3.5); }
        for (const [x, y] of [[-20, -10], [16, -2], [4, -28], [-8, 4], [24, -16], [-12, -26]]) { B(); circ(x, y, 6); fill(rad(x, y, 6, '#ffc35a', '#ff8a1f'), true, 2.5); } },
    ],
  },
  drink: {
    gen: 'Juice Cart', color: '#ff7aa2', names: ['Ice Cube', 'Lemon', 'Orange Juice', 'Lemonade', 'Pitcher', 'Milkshake', 'Ice Cream', 'Sundae', 'Parfait Tower'],
    draw: [
      () => { shadow(30, 26); B(); rr(-24, -22, 48, 48, 12); fill(lin(-24, -22, 24, 26, ['#ffffff', '#a8dcf5'])); shine(-10, -10, 9, 4); line([[10, 10], [16, 4]], 'rgba(255,255,255,.9)', 3); },
      () => { shadow(30, 34); B(); ell(0, 2, 34, 26, -0.2); fill(rad(0, 0, 36, '#fff59a', '#f2c81f')); B(); ell(-34, 8, 6, 4, -0.2); fill('#f2c81f', true, 3); leaf(20, -20, 20, 8, 0.9, '#5fbf55'); shine(-12, -8, 10, 5); },
      () => { shadow(38, 24); glass(0, 4, 44, 64, '#ffa53a'); B(); circ(16, -26, 11); fill('#ffb84d', true, 3); line([[16, -26], [8, -34]], 'rgba(255,255,255,.8)', 2); },
      () => { shadow(38, 24); line([[6, -24], [20, -48]], '#ff5d8f', 5); glass(0, 6, 44, 62, '#fff07a', 0.8); B(); ell(-14, -20, 12, 8, 0.4); fill('#ffe14d', true, 3); for (const [x, y] of [[-6, 4], [8, 14], [2, -6]]) { B(); rr(x - 5, y - 5, 10, 10, 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); } },
      () => { shadow(40, 32); B(); g.moveTo(-24, -34); g.lineTo(18, -34); g.lineTo(26, 36); g.lineTo(-26, 36); g.closePath(); fill('rgba(220,245,255,.8)'); g.save(); B(); g.moveTo(-24, -34); g.lineTo(18, -34); g.lineTo(26, 36); g.lineTo(-26, 36); g.closePath(); g.clip(); g.fillStyle = '#ff9fc0'; g.fillRect(-40, -18, 80, 60); g.restore();
        B(); g.moveTo(-24, -34); g.lineTo(18, -34); g.lineTo(26, 36); g.lineTo(-26, 36); g.closePath(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); B(); g.moveTo(18, -34); g.lineTo(30, -40); g.lineTo(20, -24); fill('rgba(220,245,255,.9)', true, 3);
        g.lineWidth = 6; g.strokeStyle = INK; B(); g.arc(30, 2, 14, -1.3, 1.3); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#dff4ff'; g.stroke(); for (const [x, y] of [[-8, 4], [8, 18]]) { B(); circ(x, y, 6); fill('#ff4d6d', true, 2); } shine(-14, -10, 3, 14, 0.05); },
      () => { shadow(40, 24); B(); g.moveTo(-20, -18); g.lineTo(-14, 38); g.lineTo(14, 38); g.lineTo(20, -18); g.closePath(); fill(lin(0, -18, 0, 38, ['#ffd6e4', '#ff8fb3']));
        B(); g.moveTo(-24, -16); g.quadraticCurveTo(-28, -34, -10, -32); g.quadraticCurveTo(0, -46, 12, -32); g.quadraticCurveTo(28, -32, 24, -16); g.closePath(); fill('#ffffff'); line([[8, -30], [18, -56]], '#3fa9f5', 6); B(); circ(-4, -40, 7); fill('#ff4d6d', true, 2.5); shine(-10, 4, 3, 12, 0.08); },
      () => { shadow(42, 18); B(); g.moveTo(-20, -6); g.lineTo(0, 44); g.lineTo(20, -6); g.closePath(); fill(lin(0, -6, 0, 44, ['#f2c27a', '#c98a3c'])); for (let k = -14; k <= 14; k += 9) { line([[k, -4], [k * 0.2 + 6, 30]], 'rgba(120,70,20,.45)', 2); line([[-k, -4], [-k * 0.2 - 6, 30]], 'rgba(120,70,20,.45)', 2); }
        B(); circ(0, -18, 20); fill(rad(0, -18, 20, '#fff6e8', '#ffd0a1')); B(); circ(0, -38, 15); fill(rad(0, -38, 15, '#ffe0ef', '#ff96bd')); shine(-6, -44, 5, 3); },
      () => { shadow(40, 30); B(); g.moveTo(-34, -4); g.quadraticCurveTo(0, 46, 34, -4); g.closePath(); fill(lin(0, -4, 0, 30, ['#dff4ff', '#a8dcf5'])); B(); rr(-8, 28, 16, 10, 3); fill('#a8dcf5', true, 3);
        for (const [x, y, c] of [[-16, -12, '#fff6e8'], [14, -12, '#ffcfe1'], [0, -24, '#b88356']]) { B(); circ(x, y, 15); fill(c, true, 3.5); } B(); g.moveTo(-18, -32); g.quadraticCurveTo(0, -20, 18, -32); g.strokeStyle = '#7a3d1c'; g.lineWidth = 5; g.stroke();
        B(); circ(0, -40, 7); fill('#ff4d6d', true, 2.5); line([[0, -46], [5, -54]], INK, 3); },
      () => { shadow(44, 26); B(); g.moveTo(-18, -26); g.lineTo(-12, 40); g.lineTo(12, 40); g.lineTo(18, -26); g.closePath(); fill('rgba(220,245,255,.85)');
        g.save(); B(); g.moveTo(-18, -26); g.lineTo(-12, 40); g.lineTo(12, 40); g.lineTo(18, -26); g.closePath(); g.clip(); const L = ['#ff8fb3', '#fff3c4', '#7ad0f0', '#ffd23f', '#b48cff']; L.forEach((c, i) => { g.fillStyle = c; g.fillRect(-30, 40 - (i + 1) * 13, 60, 13); }); g.restore();
        B(); g.moveTo(-18, -26); g.lineTo(-12, 40); g.lineTo(12, 40); g.lineTo(18, -26); g.closePath(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
        B(); g.moveTo(-22, -26); g.quadraticCurveTo(0, -46, 22, -26); g.closePath(); fill('#ffffff'); line([[10, -36], [24, -58]], '#9a6634', 3); B(); g.moveTo(10, -58); g.quadraticCurveTo(24, -70, 38, -58); g.closePath(); fill('#ff5d8f', true, 3); B(); circ(-6, -40, 6); fill('#ff4d6d', true, 2.5); },
    ],
  },
};
export const KINDS = ['sea', 'bake', 'garden', 'drink'];

// generators (one per chain)
const GEN = {
  sea: () => { shadow(40, 42); B(); ell(0, 10, 44, 30); fill(rad(0, 6, 46, '#b8c4cf', '#7d8b99')); B(); ell(0, 6, 32, 18); fill(lin(0, -10, 0, 22, ['#8fe3ff', '#2aa6d8'])); star(14, 8, 9, '#ff8a5c'); B(); circ(-14, 4, 5); fill('#ffd23f', true, 2.5); shine(-8, -2, 10, 3, 0, 0.7); for (const [x, y] of [[-30, -10], [26, -16], [34, 14]]) { B(); ell(x, y, 8, 6); fill('#a5b3c0', true, 3); } },
  bake: () => { shadow(42, 42); B(); g.moveTo(-40, 40); g.lineTo(-40, -6); g.quadraticCurveTo(-40, -42, 0, -42); g.quadraticCurveTo(40, -42, 40, -6); g.lineTo(40, 40); g.closePath(); fill(lin(0, -42, 0, 40, ['#f08a5d', '#c4532f']));
    for (let y = -30; y < 40; y += 12) for (let x = -40 + ((y / 12) % 2 ? 6 : 0); x < 40; x += 18) { B(); rr(x + 1, y + 1, 15, 9, 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); }
    B(); g.moveTo(-22, 34); g.lineTo(-22, 6); g.quadraticCurveTo(-22, -16, 0, -16); g.quadraticCurveTo(22, -16, 22, 6); g.lineTo(22, 34); g.closePath(); fill('#3a2018'); B(); ell(0, 24, 16, 8); fill(rad(0, 22, 16, '#ffe36a', '#ff7a1f'), false); line([[-40, 34], [40, 34]], INK, 4); B(); rr(-8, -50, 16, 14, 3); fill('#9aa0a6', true, 3); },
  garden: () => { shadow(42, 42); B(); rr(-40, -16, 80, 52, 6); fill(lin(0, -16, 0, 36, ['#d9a466', '#a8703a'])); for (const y of [0, 18]) line([[-38, y], [38, y]], 'rgba(75,53,39,.45)', 3); line([[-40, -16], [40, 36]], 'rgba(75,53,39,.3)', 3);
    B(); ell(0, -16, 38, 9); fill('#7a4f2a', true, 3); leaf(-14, -18, 22, 9, -0.4, '#7bd06a'); leaf(8, -18, 26, 10, 0.3, '#5fbf55'); flower(-24, -30, 9, '#ff8fb3'); flower(24, -28, 9, '#ffd84a', '#ff8a3c'); },
  drink: () => { shadow(44, 42); for (const x of [-26, 26]) { B(); circ(x, 34, 8); fill('#5b5f6b', true, 3); } B(); rr(-38, -6, 76, 38, 8); fill(lin(0, -6, 0, 32, ['#ffffff', '#ffd6e4'])); line([[-38, 8], [38, 8]], '#ff7aa2', 6); line([[0, -6], [0, -36]], INK, 4);
    B(); g.moveTo(-40, -30); g.quadraticCurveTo(0, -60, 40, -30); g.closePath(); fill('#ff7aa2'); for (const x of [-20, 0, 20]) { B(); g.moveTo(x - 10, -32); g.quadraticCurveTo(x, -26, x + 10, -32); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); } B(); ell(-14, 18, 7, 9); fill('#ffe14d', true, 2.5); B(); ell(10, 18, 7, 9); fill('#ffa53a', true, 2.5); },
};

// ---------------------------------------------------------------- bitmap cache
const cache = new Map();
export function itemBitmap(kind, tier, px, isGen = false) {
  const key = kind + tier + (isGen ? 'g' : '') + px; let c = cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = px; g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round';
  g.translate(px / 2, px / 2); g.scale(px / 116, px / 116);
  (isGen ? GEN[kind] : CHAINS[kind].draw[tier])();
  cache.set(key, c); return c;
}

// ---------------------------------------------------------------- villagers (round faces, original)
export const VILLAGERS = [
  { name: 'Marisol', skin: '#f6c7a1', hair: '#7a3e1d', style: 'bun', top: '#ff7aa2' },
  { name: 'Teo', skin: '#c98c5c', hair: '#2e2018', style: 'curly', top: '#3fa9f5' },
  { name: 'Gran Ilse', skin: '#ffd9c0', hair: '#e8e4ea', style: 'bob', top: '#b48cff', glasses: true },
  { name: 'Captain Bo', skin: '#e9b08a', hair: '#ffffff', style: 'cap', top: '#2b4d7a', beard: true },
  { name: 'Juno', skin: '#8d5a3b', hair: '#1d1410', style: 'puffs', top: '#ffb72e' },
  { name: 'Pip', skin: '#ffe0c8', hair: '#f29a3c', style: 'spiky', top: '#52b788' },
];
export function drawVillager(ctx, v, x, y, s, mood = 0) {   // s = head radius; mood 1 = delighted
  g = ctx; g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
  B(); g.moveTo(-s * 1.05, s * 1.6); g.quadraticCurveTo(-s, s * 0.7, 0, s * 0.72); g.quadraticCurveTo(s, s * 0.7, s * 1.05, s * 1.6); g.closePath(); fill(v.top, true, 3);
  if (v.style === 'bob' || v.style === 'puffs' || v.style === 'bun') { B(); if (v.style === 'puffs') { circ(-s * 0.95, -s * 0.5, s * 0.45); circ(s * 0.95, -s * 0.5, s * 0.45); } else ell(0, -s * 0.05, s * 1.12, s * 1.08); fill(v.hair, true, 3); }
  if (v.style === 'bun') { B(); circ(0, -s * 1.15, s * 0.42); fill(v.hair, true, 3); }
  B(); circ(0, 0, s); fill(rad(0, 0, s, v.skin, v.skin), true, 3);
  if (v.style === 'curly') for (let i = 0; i < 7; i++) { const a = Math.PI + 0.15 + i * (Math.PI - 0.3) / 6; B(); circ(Math.cos(a) * s * 0.88, Math.sin(a) * s * 0.88, s * 0.32); fill(v.hair, true, 2.5); }
  else if (v.style === 'spiky') { B(); g.moveTo(-s, -s * 0.1); for (let i = 0; i <= 6; i++) { const a = Math.PI + i * Math.PI / 6; g.lineTo(Math.cos(a) * s * (i % 2 ? 1.35 : 0.95), Math.sin(a) * s * (i % 2 ? 1.35 : 0.95)); } g.quadraticCurveTo(0, -s * 0.5, -s, -s * 0.1); fill(v.hair, true, 3); }
  else if (v.style === 'cap') { B(); g.moveTo(-s, -s * 0.2); g.quadraticCurveTo(0, -s * 1.6, s, -s * 0.2); g.closePath(); fill('#2b4d7a', true, 3); B(); rr(-s * 1.05, -s * 0.35, s * 2.1, s * 0.3, s * 0.12); fill('#ffffff', true, 3); B(); circ(0, -s * 0.85, s * 0.16); fill('#f2c94c', true, 2); }
  else { B(); g.moveTo(-s, 0); g.quadraticCurveTo(-s * 0.9, -s * 1.15, 0, -s * 1.05); g.quadraticCurveTo(s * 0.9, -s * 1.15, s, 0); g.quadraticCurveTo(s * 0.3, -s * 0.55, -s, 0); fill(v.hair, true, 3); }
  if (v.beard) { B(); g.moveTo(-s * 0.85, s * 0.2); g.quadraticCurveTo(0, s * 1.3, s * 0.85, s * 0.2); g.quadraticCurveTo(0, s * 0.6, -s * 0.85, s * 0.2); fill('#ffffff', true, 3); }
  const ey = -s * 0.05;
  if (mood > 0.5) { for (const ex of [-0.36, 0.36]) { B(); g.arc(ex * s, ey + s * 0.06, s * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); } }
  else for (const ex of [-0.36, 0.36]) { B(); circ(ex * s, ey, s * 0.12); g.fillStyle = INK; g.fill(); B(); circ(ex * s + s * 0.04, ey - s * 0.05, s * 0.04); g.fillStyle = '#fff'; g.fill(); }
  if (v.glasses) { g.lineWidth = 2.5; g.strokeStyle = INK; B(); circ(-0.36 * s, ey, s * 0.24); circ(0.36 * s, ey, s * 0.24); g.stroke(); line([[-0.12 * s, ey], [0.12 * s, ey]], INK, 2.5); }
  B(); circ(-s * 0.6, s * 0.3, s * 0.16); circ(s * 0.6, s * 0.3, s * 0.16); g.fillStyle = 'rgba(255,110,130,.35)'; g.fill();
  B(); if (mood > 0.5) { g.moveTo(-s * 0.3, s * 0.3); g.quadraticCurveTo(0, s * 0.8, s * 0.3, s * 0.3); g.closePath(); fill('#c94a5a', true, 2.5); } else { g.arc(0, s * 0.28, s * 0.22, 0.2, Math.PI - 0.2); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); }
  g.restore();
}

// ---------------------------------------------------------------- town buildings (restored in colour, or a sketchy plot)
const PROPS = {
  cafe: (c) => { B(); rr(-34, -40, 68, 40, 3); fill(c.wall, true, 3); B(); g.moveTo(-40, -40); g.lineTo(0, -66); g.lineTo(40, -40); g.closePath(); fill(c.roof, true, 3);
    B(); g.moveTo(-38, -30); g.lineTo(38, -30); g.lineTo(42, -18); g.lineTo(-42, -18); g.closePath(); fill('#ffffff', true, 3); for (let x = -36; x < 36; x += 16) { B(); g.moveTo(x, -30); g.lineTo(x + 8, -30); g.lineTo(x + 10, -18); g.lineTo(x + 2, -18); g.closePath(); g.fillStyle = c.acc; g.fill(); }
    B(); rr(-8, -16, 16, 16, 2); fill('#7a4f2a', true, 3); B(); rr(-28, -14, 14, 10, 2); rr(14, -14, 14, 10, 2); fill('#bfe9ff', true, 2.5); },
  light: (c) => { B(); g.moveTo(-14, 0); g.lineTo(-9, -78); g.lineTo(9, -78); g.lineTo(14, 0); g.closePath(); fill('#ffffff', true, 3); for (const y of [-20, -50]) { B(); g.moveTo(-13, y); g.lineTo(-11, y - 14); g.lineTo(11, y - 14); g.lineTo(13, y); g.closePath(); g.fillStyle = c.roof; g.fill(); }
    B(); rr(-12, -92, 24, 14, 3); fill('#ffe36a', true, 3); B(); g.moveTo(-14, -92); g.lineTo(0, -104); g.lineTo(14, -92); g.closePath(); fill(c.roof, true, 3); },
  boat: (c) => { line([[0, -14], [0, -64]], INK, 3); B(); g.moveTo(2, -62); g.lineTo(30, -20); g.lineTo(2, -20); g.closePath(); fill('#ffffff', true, 3); B(); g.moveTo(-2, -54); g.lineTo(-24, -22); g.lineTo(-2, -22); g.closePath(); fill(c.acc, true, 3);
    B(); g.moveTo(-40, -16); g.lineTo(40, -16); g.lineTo(28, 0); g.lineTo(-30, 0); g.closePath(); fill(c.roof, true, 3); line([[-36, -10], [36, -10]], '#ffffff', 3); },
  palm: (c) => { B(); g.moveTo(-4, 0); g.quadraticCurveTo(-2, -30, 6, -56); g.lineTo(12, -56); g.quadraticCurveTo(6, -30, 6, 0); g.closePath(); fill('#b07a44', true, 3);
    for (const a of [-2.7, -2, -1.2, -0.4]) { g.save(); g.translate(9, -58); g.rotate(a + Math.PI / 2); B(); g.moveTo(0, 0); g.quadraticCurveTo(10, -14, 3, -32); g.quadraticCurveTo(-5, -14, 0, 0); fill(c.leaf || '#4fc35a', true, 2.5); g.restore(); } },
  hut: (c) => { B(); rr(-26, -32, 52, 32, 3); fill(c.wall, true, 3); B(); g.moveTo(-34, -30); g.lineTo(0, -56); g.lineTo(34, -30); g.closePath(); fill('#e8c56a', true, 3); for (let x = -26; x < 30; x += 10) line([[x, -32], [x * 0.3, -52]], 'rgba(75,53,39,.3)', 2); B(); rr(-6, -18, 12, 18, 2); fill('#7a4f2a', true, 3); },
  umbrella: (c) => { line([[0, 0], [0, -46]], INK, 3); B(); g.moveTo(-34, -40); g.quadraticCurveTo(0, -72, 34, -40); g.closePath(); fill(c.acc, true, 3); for (const x of [-12, 12]) { B(); g.moveTo(0, -60); g.quadraticCurveTo(x, -50, x * 2, -40); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke(); }
    B(); rr(-26, -8, 30, 6, 3); fill('#ffffff', true, 2.5); },
  kiosk: (c) => { B(); rr(-24, -34, 48, 34, 4); fill(c.wall, true, 3); B(); rr(-20, -30, 40, 14, 3); fill('#bfe9ff', true, 2.5); B(); g.moveTo(-30, -34); g.lineTo(30, -34); g.lineTo(26, -50); g.lineTo(-26, -50); g.closePath(); fill(c.acc, true, 3); B(); circ(0, -60, 9); fill('#ffd23f', true, 3); },
  windmill: (c) => { B(); g.moveTo(-18, 0); g.lineTo(-12, -60); g.lineTo(12, -60); g.lineTo(18, 0); g.closePath(); fill(c.wall, true, 3); B(); g.moveTo(-16, -58); g.lineTo(0, -76); g.lineTo(16, -58); g.closePath(); fill(c.roof, true, 3);
    for (let i = 0; i < 4; i++) { g.save(); g.translate(0, -60); g.rotate(i * Math.PI / 2 + 0.4); B(); rr(-5, -40, 10, 36, 2); fill('#ffffff', true, 2.5); g.restore(); } B(); circ(0, -60, 4); fill(INK, false); },
  pier: (c) => { B(); rr(-44, -16, 88, 8, 2); fill('#c08a52', true, 3); for (const x of [-38, -14, 10, 34]) { B(); rr(x, -10, 6, 14, 1); fill('#8f5c2c', true, 2.5); } line([[-44, -28], [44, -28]], '#ffffff', 3); for (const x of [-40, 0, 40]) line([[x, -16], [x, -30]], INK, 3); },
};
export const PROP_KEYS = Object.keys(PROPS);
export function drawProp(ctx, key, x, y, s, colors, ghost = 0) {
  g = ctx; g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
  B(); ell(0, 0, 40, 6); g.fillStyle = 'rgba(40,60,80,.18)'; g.fill();
  if (ghost) {
    g.globalAlpha = 0.42; const c = { wall: '#dfe6ee', roof: '#c8d2de', acc: '#c8d2de', leaf: '#c8d2de' }; PROPS[key](c); g.globalAlpha = 1;
    line([[-30, 0], [-30, -28]], '#c08a52', 3); line([[30, 0], [30, -28]], '#c08a52', 3); line([[-34, -22], [34, -22]], '#c08a52', 3); line([[-34, -8], [34, -8]], '#c08a52', 3);
  } else PROPS[key](colors);
  g.restore();
}

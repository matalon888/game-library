// icons.js — our own flat-cute tile icons, drawn on canvas (kittens, fish, yarn, paw, toys).
const TAU = Math.PI * 2;
function ell(g, x, y, rx, ry, fill, stroke, lw = 4) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); } }
function tri(g, pts, fill, stroke) { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = stroke; g.stroke(); } }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; r = Math.round(r * k); gg = Math.round(gg * k); b = Math.round(b * k); return `rgb(${Math.min(255, r)},${Math.min(255, gg)},${Math.min(255, b)})`; }
function catFace(g, o) {
  const line = shade(o.fur, 0.62);
  tri(g, [[22, 50], [30, 10], [58, 34]], o.fur, line); tri(g, [[106, 50], [98, 10], [70, 34]], o.fur, line);
  tri(g, [[30, 42], [33, 20], [50, 34]], o.inner || '#ff9fbd'); tri(g, [[98, 42], [95, 20], [78, 34]], o.inner || '#ff9fbd');
  ell(g, 64, 70, 48, 41, o.fur, line, 5);
  if (o.patch) { g.save(); g.beginPath(); g.ellipse(64, 70, 46, 39, 0, 0, TAU); g.clip(); ell(g, 36, 52, 26, 22, o.patch); ell(g, 96, 92, 22, 18, o.patch2 || o.patch); g.restore(); }
  if (o.mask) { g.save(); g.beginPath(); g.ellipse(64, 70, 46, 39, 0, 0, TAU); g.clip(); ell(g, 64, 84, 30, 22, o.mask); g.restore(); }
  if (o.stripe) { g.strokeStyle = o.stripe; g.lineWidth = 5; g.lineCap = 'round'; for (const [x, a] of [[52, -0.25], [64, 0], [76, 0.25]]) { g.beginPath(); g.moveTo(x, 33); g.lineTo(x + Math.sin(a) * 10, 46); g.stroke(); } }
  ell(g, 64, 88, 15, 10, o.muzzle || '#fff6ec');
  for (const s of [-1, 1]) { ell(g, 64 + s * 19, 68, 10, 12, o.eye || '#2a1d18'); ell(g, 64 + s * 19 + 3, 63, 4, 4.5, '#fff'); ell(g, 64 + s * 19 - 3, 73, 2, 2, '#fff'); ell(g, 64 + s * 34, 84, 7, 4.5, 'rgba(255,110,150,.55)'); }
  tri(g, [[58, 81], [70, 81], [64, 88]], '#ff7aa2');
  g.strokeStyle = '#4a2c24'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(59, 89, 5, 0.1, Math.PI - 0.3); g.stroke(); g.beginPath(); g.arc(69, 89, 5, 0.3, Math.PI - 0.1); g.stroke();
  g.strokeStyle = o.whisker || 'rgba(80,50,40,.6)'; g.lineWidth = 2;
  for (const s of [-1, 1]) for (const d of [-5, 3]) { g.beginPath(); g.moveTo(64 + s * 26, 86 + d * 0.3); g.lineTo(64 + s * 50, 82 + d); g.stroke(); }
  if (o.bow) { tri(g, [[30, 18], [14, 8], [16, 30]], o.bow, shade(o.bow, 0.7)); tri(g, [[30, 18], [44, 6], [46, 28]], o.bow, shade(o.bow, 0.7)); ell(g, 30, 18, 6, 6, '#fff'); }
}
export const ICONS = [
  { n: 'ginger', draw: g => catFace(g, { fur: '#ffa24c', stripe: '#e07020' }) },
  { n: 'grey', draw: g => catFace(g, { fur: '#aab3c2', stripe: '#6f7a8c', eye: '#1f4a30' }) },
  { n: 'black', draw: g => catFace(g, { fur: '#3a3340', muzzle: '#f2e6dc', eye: '#c88a10', whisker: 'rgba(255,255,255,.7)', inner: '#ff8fb0' }) },
  { n: 'snow', draw: g => catFace(g, { fur: '#fffaf4', bow: '#ff4f9a', eye: '#2a5bd0' }) },
  { n: 'siamese', draw: g => catFace(g, { fur: '#f3e2c7', mask: '#7a5640', inner: '#7a5640', eye: '#2a7bd8', muzzle: '#9a7258' }) },
  { n: 'calico', draw: g => catFace(g, { fur: '#ffffff', patch: '#ff9a3c', patch2: '#3a3340', eye: '#3a6a20' }) },
  { n: 'fish', draw: g => { tri(g, [[96, 64], [122, 40], [122, 88]], '#2f8cff', '#1b5bb0'); ell(g, 60, 64, 44, 30, '#4aa6ff', '#1b5bb0', 5); g.strokeStyle = '#2f7de0'; g.lineWidth = 4; for (const x of [62, 76]) { g.beginPath(); g.arc(x, 64, 22, -0.9, 0.9); g.stroke(); } ell(g, 34, 58, 8, 8, '#fff'); ell(g, 33, 58, 4.5, 4.5, '#1a1a2a'); ell(g, 52, 50, 10, 4, 'rgba(255,255,255,.6)'); } },
  { n: 'yarn', draw: g => { g.strokeStyle = '#d0307a'; g.lineWidth = 5; g.beginPath(); g.moveTo(96, 96); g.bezierCurveTo(112, 108, 118, 90, 122, 112); g.stroke(); ell(g, 60, 62, 44, 44, '#ff6fae', '#c02c70', 5); g.save(); g.beginPath(); g.arc(60, 62, 42, 0, TAU); g.clip(); g.strokeStyle = '#ffc2dd'; g.lineWidth = 4; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(60 + i * 12, 62, 18, 60, 0.6, 0, TAU); g.stroke(); } g.restore(); ell(g, 44, 44, 9, 5, 'rgba(255,255,255,.6)'); } },
  { n: 'paw', draw: g => { ell(g, 64, 80, 30, 26, '#9b5cff', '#6430c0', 5); for (const [x, y] of [[30, 50], [50, 30], [78, 30], [98, 50]]) ell(g, x, y, 12, 15, '#9b5cff', '#6430c0', 4); ell(g, 56, 72, 8, 5, 'rgba(255,255,255,.5)'); } },
  { n: 'milk', draw: g => { g.fillStyle = '#ffffff'; g.strokeStyle = '#7a9cc0'; g.lineWidth = 5; g.beginPath(); g.moveTo(46, 34); g.lineTo(82, 34); g.lineTo(92, 56); g.lineTo(92, 112); g.quadraticCurveTo(92, 118, 86, 118); g.lineTo(42, 118); g.quadraticCurveTo(36, 118, 36, 112); g.lineTo(36, 56); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#3d8cff'; g.fillRect(38, 66, 52, 30); g.fillStyle = '#ff5d8f'; g.fillRect(44, 14, 40, 20); g.strokeRect(44, 14, 40, 20); ell(g, 64, 81, 10, 9, '#fff'); for (const s of [-1, 1]) tri(g, [[64 + s * 4, 74], [64 + s * 9, 66], [64 + s * 10, 76]], '#fff'); } },
  { n: 'can', draw: g => { ell(g, 64, 98, 44, 16, '#9aa4b2', '#5c6676'); g.fillStyle = '#ff4d5e'; g.fillRect(20, 50, 88, 48); g.strokeStyle = '#5c6676'; g.lineWidth = 5; g.beginPath(); g.moveTo(20, 50); g.lineTo(20, 98); g.moveTo(108, 50); g.lineTo(108, 98); g.stroke(); ell(g, 64, 50, 44, 16, '#d8dee8', '#5c6676'); ell(g, 64, 50, 34, 10, '#b8c0cc'); tri(g, [[84, 76], [98, 66], [98, 86]], '#fff'); ell(g, 62, 76, 22, 11, '#fff'); ell(g, 50, 74, 3, 3, '#ff4d5e'); } },
  { n: 'mouse', draw: g => { g.strokeStyle = '#ff7aa2'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(100, 84); g.bezierCurveTo(120, 80, 116, 108, 124, 110); g.stroke(); ell(g, 62, 78, 44, 30, '#b9b2c8', '#6e6680', 5); ell(g, 40, 50, 16, 16, '#b9b2c8', '#6e6680', 4); ell(g, 40, 50, 9, 9, '#ffb0c8'); ell(g, 26, 76, 5, 5, '#2a1d18'); ell(g, 18, 86, 6, 5, '#ff7aa2'); ell(g, 70, 64, 14, 6, 'rgba(255,255,255,.5)'); } },
  { n: 'bell', draw: g => { g.fillStyle = '#ff4d5e'; g.strokeStyle = '#a82034'; g.lineWidth = 5; g.beginPath(); g.roundRect ? g.roundRect(10, 22, 108, 22, 10) : g.rect(10, 22, 108, 22); g.fill(); g.stroke(); ell(g, 64, 78, 36, 36, '#ffd23f', '#c08a00', 5); g.strokeStyle = '#c08a00'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, 76); g.lineTo(98, 76); g.stroke(); ell(g, 64, 94, 7, 7, '#7a5200'); g.beginPath(); g.moveTo(64, 94); g.lineTo(64, 112); g.stroke(); ell(g, 50, 62, 10, 6, 'rgba(255,255,255,.65)'); } },
];
export function iconCanvas(i, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.scale(size / 128, size / 128); ICONS[i].draw(g); return c;
}

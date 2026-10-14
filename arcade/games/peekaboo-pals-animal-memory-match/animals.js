// Original cartoon animal faces drawn on a canvas (our own art, no assets). drawAnimal(ctx, name, size) and makeTexture().
const TAU = Math.PI * 2;
function circle(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); }
function ellipse(c, x, y, rx, ry, fill, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fillStyle = fill; c.fill(); }
function tri(c, pts, fill) { c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.closePath(); c.fillStyle = fill; c.fill(); }
function eyes(c, x, y, gap, r, { lash = false } = {}) {
  for (const s of [-1, 1]) {
    circle(c, x + s * gap, y, r, '#2b2140');
    circle(c, x + s * gap - r * 0.32, y - r * 0.35, r * 0.38, '#ffffff');
    circle(c, x + s * gap + r * 0.3, y + r * 0.3, r * 0.16, '#ffffff');
  }
}
function cheeks(c, x, y, gap, r) { for (const s of [-1, 1]) ellipse(c, x + s * gap, y, r, r * 0.65, 'rgba(255,110,140,0.45)'); }
function smile(c, x, y, w, col = '#2b2140', lw = 5) { c.beginPath(); c.lineWidth = lw; c.lineCap = 'round'; c.strokeStyle = col; c.moveTo(x - w, y); c.quadraticCurveTo(x - w / 2, y + w * 0.7, x, y); c.quadraticCurveTo(x + w / 2, y + w * 0.7, x + w, y); c.stroke(); }

export const ANIMALS = {
  cat(c) { tri(c, [[48, 100], [62, 26], [112, 70]], '#ff9f43'); tri(c, [[208, 100], [194, 26], [144, 70]], '#ff9f43'); tri(c, [[60, 88], [66, 46], [98, 72]], '#ffc2a8'); tri(c, [[196, 88], [190, 46], [158, 72]], '#ffc2a8');
    ellipse(c, 128, 138, 92, 82, '#ff9f43'); for (const x of [104, 128, 152]) ellipse(c, x, 70, 7, 16, '#e67e22');
    eyes(c, 128, 128, 36, 15); tri(c, [[118, 150], [138, 150], [128, 162]], '#ff6b8b'); smile(c, 128, 166, 14);
    c.strokeStyle = '#7a4b2a'; c.lineWidth = 3; for (const s of [-1, 1]) for (const d of [-8, 6]) { c.beginPath(); c.moveTo(128 + s * 46, 156 + d * 0.4); c.lineTo(128 + s * 86, 150 + d); c.stroke(); }
    cheeks(c, 128, 160, 58, 13); },
  dog(c) { ellipse(c, 128, 138, 86, 80, '#d9a066'); ellipse(c, 52, 130, 26, 58, '#8b5a2b', 0.25); ellipse(c, 204, 130, 26, 58, '#8b5a2b', -0.25);
    ellipse(c, 158, 110, 30, 26, '#f3d3a8'); ellipse(c, 128, 168, 44, 34, '#f3d3a8'); eyes(c, 128, 122, 34, 14); ellipse(c, 128, 156, 15, 11, '#2b2140');
    c.beginPath(); c.moveTo(128, 166); c.lineTo(128, 176); c.lineWidth = 4; c.strokeStyle = '#2b2140'; c.stroke(); smile(c, 128, 176, 14); ellipse(c, 128, 192, 9, 11, '#ff6b8b'); },
  bear(c) { circle(c, 60, 66, 30, '#9c6b3f'); circle(c, 196, 66, 30, '#9c6b3f'); circle(c, 60, 66, 16, '#e0b48a'); circle(c, 196, 66, 16, '#e0b48a');
    ellipse(c, 128, 136, 92, 84, '#9c6b3f'); ellipse(c, 128, 166, 40, 30, '#e0b48a'); eyes(c, 128, 124, 36, 14); ellipse(c, 128, 154, 15, 10, '#2b2140'); smile(c, 128, 172, 12); cheeks(c, 128, 160, 60, 12); },
  bunny(c) { ellipse(c, 92, 52, 22, 56, '#f5f0ff', -0.15); ellipse(c, 164, 52, 22, 56, '#f5f0ff', 0.15); ellipse(c, 92, 56, 11, 40, '#ffb3c8', -0.15); ellipse(c, 164, 56, 11, 40, '#ffb3c8', 0.15);
    ellipse(c, 128, 150, 86, 74, '#f5f0ff'); eyes(c, 128, 142, 34, 14); tri(c, [[120, 162], [136, 162], [128, 170]], '#ff6b8b'); smile(c, 128, 174, 12);
    c.fillStyle = '#ffffff'; c.fillRect(119, 178, 8, 12); c.fillRect(129, 178, 8, 12); cheeks(c, 128, 168, 56, 13); },
  pig(c) { tri(c, [[56, 90], [60, 40], [100, 66]], '#ff9fbf'); tri(c, [[200, 90], [196, 40], [156, 66]], '#ff9fbf'); ellipse(c, 128, 138, 92, 82, '#ffb3cf');
    eyes(c, 128, 116, 38, 13); ellipse(c, 128, 160, 34, 24, '#ff8db5'); ellipse(c, 117, 160, 6, 9, '#c2185b'); ellipse(c, 139, 160, 6, 9, '#c2185b'); smile(c, 128, 192, 12); },
  frog(c) { circle(c, 82, 74, 34, '#5cd65c'); circle(c, 174, 74, 34, '#5cd65c'); ellipse(c, 128, 148, 96, 70, '#5cd65c');
    circle(c, 82, 72, 22, '#ffffff'); circle(c, 174, 72, 22, '#ffffff'); eyes(c, 128, 74, 46, 13); smile(c, 128, 160, 44, '#1f6b2a', 6); cheeks(c, 128, 150, 66, 13); },
  mouse(c) { circle(c, 58, 74, 40, '#b8bcc8'); circle(c, 198, 74, 40, '#b8bcc8'); circle(c, 58, 74, 24, '#ffc2d4'); circle(c, 198, 74, 24, '#ffc2d4');
    ellipse(c, 128, 146, 80, 76, '#c9ccd6'); eyes(c, 128, 136, 32, 13); circle(c, 128, 168, 11, '#ff6b8b'); smile(c, 128, 182, 10); cheeks(c, 128, 166, 52, 11); },
  lion(c) { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; circle(c, 128 + Math.cos(a) * 84, 134 + Math.sin(a) * 80, 30, i % 2 ? '#e67e22' : '#f39c12'); }
    circle(c, 82, 74, 18, '#ffd166'); circle(c, 174, 74, 18, '#ffd166'); ellipse(c, 128, 136, 72, 68, '#ffd166'); eyes(c, 128, 124, 30, 13); ellipse(c, 128, 160, 30, 22, '#fff1c9');
    tri(c, [[116, 148], [140, 148], [128, 160]], '#8b4513'); smile(c, 128, 170, 12); },
  chick(c) { for (const a of [-0.4, 0, 0.4]) ellipse(c, 128 + a * 40, 46, 8, 22, '#ffd23f', a); circle(c, 128, 140, 92, '#ffe066');
    eyes(c, 128, 124, 38, 14); tri(c, [[110, 146], [146, 146], [128, 170]], '#ff8c42'); cheeks(c, 128, 156, 62, 14); },
  cow(c) { ellipse(c, 70, 58, 12, 20, '#f2e3c6', -0.6); ellipse(c, 186, 58, 12, 20, '#f2e3c6', 0.6); ellipse(c, 38, 108, 30, 16, '#ffffff', 0.3); ellipse(c, 218, 108, 30, 16, '#ffffff', -0.3);
    ellipse(c, 128, 132, 84, 86, '#ffffff'); ellipse(c, 86, 104, 26, 30, '#3d3a4b'); ellipse(c, 176, 92, 18, 16, '#3d3a4b'); ellipse(c, 128, 182, 56, 36, '#ffb3cf');
    ellipse(c, 108, 182, 8, 11, '#c2185b'); ellipse(c, 148, 182, 8, 11, '#c2185b'); eyes(c, 128, 126, 36, 13); },
  fox(c) { tri(c, [[44, 108], [50, 20], [112, 72]], '#ff7a1a'); tri(c, [[212, 108], [206, 20], [144, 72]], '#ff7a1a'); tri(c, [[58, 94], [60, 42], [98, 72]], '#2b2140');
    tri(c, [[198, 94], [196, 42], [158, 72]], '#2b2140'); c.beginPath(); c.moveTo(36, 120); c.quadraticCurveTo(128, 30, 220, 120); c.quadraticCurveTo(190, 210, 128, 222); c.quadraticCurveTo(66, 210, 36, 120); c.fillStyle = '#ff8c42'; c.fill();
    c.beginPath(); c.moveTo(56, 150); c.quadraticCurveTo(128, 120, 200, 150); c.quadraticCurveTo(170, 214, 128, 220); c.quadraticCurveTo(86, 214, 56, 150); c.fillStyle = '#fff6ea'; c.fill();
    eyes(c, 128, 132, 38, 13); ellipse(c, 128, 188, 12, 9, '#2b2140'); smile(c, 128, 200, 9); },
  owl(c) { tri(c, [[50, 80], [64, 28], [96, 64]], '#8d6e63'); tri(c, [[206, 80], [192, 28], [160, 64]], '#8d6e63'); ellipse(c, 128, 138, 92, 86, '#a1887f');
    circle(c, 88, 120, 36, '#fff3e0'); circle(c, 168, 120, 36, '#fff3e0'); eyes(c, 128, 120, 40, 18); tri(c, [[116, 146], [140, 146], [128, 168]], '#ffb300');
    for (const [x, y] of [[100, 190], [128, 196], [156, 190]]) { c.beginPath(); c.arc(x, y, 10, 0.2, Math.PI - 0.2); c.strokeStyle = '#6d4c41'; c.lineWidth = 4; c.stroke(); } },
  penguin(c) { ellipse(c, 128, 136, 92, 88, '#2f3550'); c.beginPath(); c.moveTo(128, 104); c.bezierCurveTo(70, 70, 50, 150, 80, 190); c.quadraticCurveTo(128, 222, 176, 190); c.bezierCurveTo(206, 150, 186, 70, 128, 104); c.fillStyle = '#ffffff'; c.fill();
    eyes(c, 128, 134, 30, 13); tri(c, [[112, 156], [144, 156], [128, 172]], '#ffa62b'); cheeks(c, 128, 166, 50, 12); },
  monkey(c) { circle(c, 44, 132, 30, '#8d5b3a'); circle(c, 212, 132, 30, '#8d5b3a'); circle(c, 44, 132, 18, '#f1c9a5'); circle(c, 212, 132, 18, '#f1c9a5'); circle(c, 128, 130, 84, '#8d5b3a');
    circle(c, 100, 118, 34, '#f1c9a5'); circle(c, 156, 118, 34, '#f1c9a5'); ellipse(c, 128, 166, 54, 38, '#f1c9a5'); eyes(c, 128, 120, 28, 12);
    ellipse(c, 120, 152, 4, 5, '#5d3a24'); ellipse(c, 136, 152, 4, 5, '#5d3a24'); smile(c, 128, 172, 20); },
  koala(c) { circle(c, 48, 82, 44, '#a7b0be'); circle(c, 208, 82, 44, '#a7b0be'); circle(c, 48, 82, 26, '#f6e1ea'); circle(c, 208, 82, 26, '#f6e1ea'); ellipse(c, 128, 142, 84, 80, '#b8c0cc');
    eyes(c, 128, 130, 38, 12); ellipse(c, 128, 158, 18, 24, '#3d3a4b'); smile(c, 128, 192, 10); cheeks(c, 128, 166, 58, 12); },
  tiger(c) { circle(c, 66, 66, 26, '#ff9f1c'); circle(c, 190, 66, 26, '#ff9f1c'); circle(c, 66, 66, 13, '#fff1c9'); circle(c, 190, 66, 13, '#fff1c9'); ellipse(c, 128, 138, 92, 84, '#ff9f1c');
    for (const [x, y, r] of [[128, 66, 0], [104, 70, -0.2], [152, 70, 0.2], [44, 140, 1.4], [212, 140, -1.4], [52, 168, 1.2], [204, 168, -1.2]]) ellipse(c, x, y, 6, 20, '#3d2b1f', r);
    ellipse(c, 128, 168, 48, 32, '#fff6ea'); eyes(c, 128, 126, 36, 13); tri(c, [[118, 152], [138, 152], [128, 162]], '#ff6b8b'); smile(c, 128, 168, 12); },
};
export const NAMES = Object.keys(ANIMALS);
export const TILE = { cat: '#ffe7c7', dog: '#ffe9d1', bear: '#ffe0c2', bunny: '#e9e3ff', pig: '#ffe3ef', frog: '#e3ffe0', mouse: '#eef0f6', lion: '#fff3c4', chick: '#fff8d6',
  cow: '#e6f7ff', fox: '#ffe8d6', owl: '#f3e9e2', penguin: '#dff3ff', monkey: '#f7e6d6', koala: '#eef1f5', tiger: '#fff0d6' };

/** card face canvas: rounded tile in the animal's colour, face centred */
export function faceCanvas(name, S = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  c.fillStyle = TILE[name]; c.fillRect(0, 0, S, S);
  c.save(); c.translate(S * 0.03, S * 0.05); c.scale(S / 256 * 0.94, S / 256 * 0.94); ANIMALS[name](c); c.restore();
  return cv;
}
/** card back: playful paw-and-star pattern (original) */
export function backCanvas(colA, colB, S = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, colA); g.addColorStop(1, colB); c.fillStyle = g; c.fillRect(0, 0, S, S);
  c.fillStyle = 'rgba(255,255,255,0.22)';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const px = x * 56 + (y % 2) * 28 - 10, py = y * 56 + 4; star(c, px, py, 9, 4); }
  // big paw in the middle
  c.fillStyle = 'rgba(255,255,255,0.92)'; ellipse(c, 128, 146, 38, 32, 'rgba(255,255,255,0.92)');
  for (const [x, y] of [[84, 100], [112, 82], [144, 82], [172, 100]]) ellipse(c, x, y, 15, 19, 'rgba(255,255,255,0.92)');
  return cv;
}
function star(c, x, y, r, r2) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? r2 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }

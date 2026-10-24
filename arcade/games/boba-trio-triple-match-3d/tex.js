// Code-built art for Boba Trio (no image files): the tufted lilac cushion (geometry + texture), the dreamy bokeh backdrop,
// café / dorm room surfaces and a soft shadow blob. Kawaii Pop palette: lilac, strawberry, mint, butter + neon accents.
import { THREE } from './kit/hc.js';

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// ---------------------------------------------------------------- cushion
// A puffy rounded-rectangle cushion: a big rolled rim around a quilted (tufted) bed with pearl buttons.
// The physics box (w × d) sits exactly inside the rim, so the heap rests on the quilted bed.
export function cushion(w, d, { rim = 1.7, roll = 1.0, cell = 1.25, radius = 2.4, seg = 150 } = {}) {
  const A = w / 2 + rim, B = d / 2 + rim, rc = Math.min(radius, A, B);
  const sdf = (x, z) => { const qx = Math.abs(x) - (A - rc), qz = Math.abs(z) - (B - rc); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rc; };
  const tuft = (x, z) => {           // 0 at seams/buttons, 1 in the middle of each diamond
    const u = (x + z) / cell, v = (x - z) / cell, fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
    return 1 - Math.max(Math.abs(fu), Math.abs(fv)) * 2;
  };
  const height = (x, z) => {
    const e = -sdf(x, z);                                       // distance inside the edge
    if (e < 0) return -0.7;
    if (e < rim) { const k = (e - rim * 0.5) / (rim * 0.5); return roll * Math.sqrt(Math.max(0, 1 - k * k)) * (0.85 + 0.15 * Math.pow(Math.max(0, tuft(x * 0.6, z * 0.6)), 0.5)) - 0.04; }
    const blend = Math.min(1, (e - rim) / 0.5);
    return (Math.pow(Math.max(0, tuft(x, z)), 0.6) * 0.16 - 0.1) * blend;
  };
  const nx = seg, nz = Math.round(seg * B / A);
  const geo = new THREE.PlaneGeometry(2 * A + 0.6, 2 * B + 0.6, nx, nz); geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), z = P.getZ(i);
    const s = sdf(x, z);
    if (s > 0) {                    // pull outside vertices onto the edge and down: a soft skirt
      const g = 0.01, gx = (sdf(x + g, z) - sdf(x - g, z)) / (2 * g), gz = (sdf(x, z + g) - sdf(x, z - g)) / (2 * g);
      x -= gx * s; z -= gz * s; P.setXYZ(i, x * 1.0, -0.15 - Math.min(0.6, s * 2), z);
    } else P.setY(i, height(x, z));
  }
  geo.computeVertexNormals();
  // texture: lilac gradient, quilt seams, pearl buttons, a satin sheen on the rim
  const n = 1024, [c, x] = canvas(n, Math.round(n * B / A));
  const W = c.width, H = c.height, sx = (2 * A + 0.6) / W, sz = (2 * B + 0.6) / H;
  const img = x.createImageData(W, H), D = img.data;
  const c1 = new THREE.Color('#c9a0fb'), c2 = new THREE.Color('#a978ea'), cr = new THREE.Color('#d4adfc');
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const wx = -A - 0.3 + px * sx, wz = -B - 0.3 + py * sz, e = -sdf(wx, wz), i = (py * W + px) * 4;
    let r, g, b;
    if (e < rim) { const k = Math.max(0, e) / rim; r = cr.r * (0.9 + 0.1 * k); g = cr.g * (0.9 + 0.1 * k); b = cr.b; }
    else { const t = (wz + B) / (2 * B), tf = tuft(wx, wz); const kk = 0.78 + 0.26 * Math.pow(Math.max(0, tf), 0.5); r = (c1.r * (1 - t) + c2.r * t) * kk; g = (c1.g * (1 - t) + c2.g * t) * kk; b = (c1.b * (1 - t) + c2.b * t) * kk; }
    const nz2 = (Math.random() - 0.5) * 0.03;
    D[i] = Math.min(255, (r + nz2) * 255); D[i + 1] = Math.min(255, (g + nz2) * 255); D[i + 2] = Math.min(255, (b + nz2) * 255); D[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // stitched seams on the bed
  x.save(); x.beginPath();
  x.rect((rim + 0.1) / sx, (rim + 0.1) / sz, (2 * A + 0.6 - 2 * rim - 0.2) / sx, (2 * B + 0.6 - 2 * rim - 0.2) / sz); x.clip();
  x.strokeStyle = 'rgba(255,255,255,0.32)'; x.lineWidth = 2; x.setLineDash([7, 7]);
  const toPx = (wx, wz) => [(wx + A + 0.3) / sx, (wz + B + 0.3) / sz];
  for (let k = -30; k <= 30; k++) {
    let [a0, b0] = toPx(-A, -A + k * cell), [a1, b1] = toPx(A, A + k * cell); x.beginPath(); x.moveTo(a0, b0); x.lineTo(a1, b1); x.stroke();
    [a0, b0] = toPx(-A, A + k * cell); [a1, b1] = toPx(A, -A + k * cell); x.beginPath(); x.moveTo(a0, b0); x.lineTo(a1, b1); x.stroke();
  }
  x.setLineDash([]);
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
    // buttons where seams cross: u, v integers → x = (u+v)/2·cell, z = (u−v)/2·cell
    const wx = (i + j) / 2 * cell, wz = (i - j) / 2 * cell; if (Math.abs(wx) > A || Math.abs(wz) > B) continue;
    if (-sdf(wx, wz) < rim + 0.25) continue;
    const [px, py] = toPx(wx, wz);
    x.fillStyle = 'rgba(70,30,110,0.28)'; x.beginPath(); x.arc(px + 1.5, py + 2.5, 8, 0, 7); x.fill();
    const gr = x.createRadialGradient(px - 2.5, py - 2.5, 1, px, py, 7.5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f6e8ff'); gr.addColorStop(1, '#c9a5f0');
    x.fillStyle = gr; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill();
  }
  x.restore();
  // rim piping: a satin cord where the roll meets the bed, and one at the outer edge
  for (const [ee, col, lw] of [[rim, 'rgba(255,255,255,0.75)', 5], [0.12, 'rgba(255,214,250,0.8)', 6]]) {
    x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
    const aa = A - ee, bb = B - ee, rr = Math.max(0.1, rc - ee), [ox, oy] = toPx(0, 0);
    x.roundRect(ox - aa / sx, oy - bb / sz, 2 * aa / sx, 2 * bb / sz, rr / sx); x.stroke();
  }
  const map = tex(c);
  return { geo, map, A, B };
}

// ---------------------------------------------------------------- backdrop: a dreamy lilac room, out of focus
export function bokeh(w = 512, h = 1024) {
  const [c, x] = canvas(w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#4a2a86'); g.addColorStop(0.35, '#6a3fae'); g.addColorStop(0.7, '#5a3399'); g.addColorStop(1, '#3a2170');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // soft shapes: shelves, lamps, a window glow
  const blob = (cx, cy, r, col, a) => { const gg = x.createRadialGradient(cx, cy, 0, cx, cy, r); gg.addColorStop(0, col.replace('A', a)); gg.addColorStop(1, col.replace('A', 0)); x.fillStyle = gg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  blob(w * 0.12, h * 0.16, 160, 'rgba(255,170,90,A)', 0.55);
  blob(w * 0.9, h * 0.12, 120, 'rgba(255,120,200,A)', 0.4);
  blob(w * 0.85, h * 0.55, 200, 'rgba(180,120,255,A)', 0.35);
  blob(w * 0.1, h * 0.62, 180, 'rgba(255,110,190,A)', 0.3);
  blob(w * 0.5, h * 0.95, 260, 'rgba(255,140,220,A)', 0.3);
  // bokeh dots
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cols = ['255,200,120', '255,150,220', '200,170,255', '255,255,255', '150,230,255'];
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * w, cy = rnd() * h, r = 6 + rnd() * 26, col = cols[(rnd() * cols.length) | 0], a = 0.12 + rnd() * 0.3;
    const gg = x.createRadialGradient(cx, cy, r * 0.55, cx, cy, r); gg.addColorStop(0, `rgba(${col},${a})`); gg.addColorStop(0.85, `rgba(${col},${a * 0.8})`); gg.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  }
  // tiny sparkles
  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 40; i++) { const cx = rnd() * w, cy = rnd() * h, r = 0.8 + rnd() * 1.6; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  return tex(c);
}

// ---------------------------------------------------------------- room surfaces
export function checker(a = '#ffd6ea', b = '#fff3fa', n = 512, cells = 8) {
  const [c, x] = canvas(n), s = n / cells;
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * s, j * s, s, s); }
  x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2; for (let i = 0; i <= cells; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, n); x.moveTo(0, i * s); x.lineTo(n, i * s); x.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function wallpaper(a = '#e7d2ff', b = '#dcc1fb', n = 512) {
  const [c, x] = canvas(n); const w = n / 8;
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * w, 0, w, n); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    const cx = i * w + w / 2, cy = j * (n / 6) + (i % 2 ? n / 12 : 0) + 20;
    // tiny hearts and stars
    x.fillStyle = (i + j) % 2 ? 'rgba(255,140,200,0.55)' : 'rgba(255,255,255,0.75)';
    if ((i + j) % 2) { x.beginPath(); x.moveTo(cx, cy + 5); x.bezierCurveTo(cx - 9, cy - 2, cx - 4, cy - 9, cx, cy - 4); x.bezierCurveTo(cx + 4, cy - 9, cx + 9, cy - 2, cx, cy + 5); x.fill(); }
    else { x.beginPath(); for (let k = 0; k < 10; k++) { const a2 = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 2.6 : 6; x.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r); } x.fill(); }
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function blob(n = 128) {
  const [c, x] = canvas(n), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(40,10,70,0.55)'); g.addColorStop(1, 'rgba(40,10,70,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  return new THREE.CanvasTexture(c);
}

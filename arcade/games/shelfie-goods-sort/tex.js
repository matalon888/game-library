// Canvas-painted textures for the shop (no image files): wood, damask, subway tile, gingham, wallpaper, shop sign, blob.
import { THREE } from './kit/hc.js';

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, rep = 1, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const R = (a, b) => a + Math.random() * (b - a);

/** warm wood planks (vertical grain when rotated) */
export function wood(base = '#c98a5a', n = 512, planks = 4) {
  const [c, x] = canvas(n); x.fillStyle = base; x.fillRect(0, 0, n, n);
  const h = n / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * h, tint = R(-0.07, 0.07);
    x.fillStyle = tint > 0 ? `rgba(255,232,205,${tint})` : `rgba(90,45,20,${-tint})`; x.fillRect(0, y0, n, h);
    for (let k = 0; k < 22; k++) {
      x.strokeStyle = `rgba(${Math.random() < 0.55 ? '100,55,25' : '255,225,190'},${R(0.04, 0.1)})`; x.lineWidth = R(0.8, 2.4);
      x.beginPath(); let yy = y0 + Math.random() * h; x.moveTo(0, yy);
      for (let xx = 0; xx <= n; xx += 24) { yy += R(-1.6, 1.6); x.lineTo(xx, Math.max(y0 + 2, Math.min(y0 + h - 2, yy))); }
      x.stroke();
    }
    x.fillStyle = 'rgba(70,35,15,0.35)'; x.fillRect(0, y0, n, 2);
  }
  return tex(c);
}

/** damask / floral wallpaper: soft two-tone with a repeating ornament */
export function damask(a = '#ffe6ea', b = '#f9cfd8', n = 512) {
  const [c, x] = canvas(n); x.fillStyle = a; x.fillRect(0, 0, n, n);
  const cell = n / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = i * cell + cell / 2 + (j % 2 ? cell / 2 : 0), cy = j * cell + cell / 2;
    x.save(); x.translate(cx % n, cy); x.fillStyle = b;
    for (let k = 0; k < 4; k++) { x.rotate(Math.PI / 2); x.beginPath(); x.ellipse(0, -cell * 0.2, cell * 0.08, cell * 0.2, 0, 0, 7); x.fill(); }
    x.beginPath(); x.arc(0, 0, cell * 0.07, 0, 7); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill();
    x.restore();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc((cx + cell / 2) % n, cy + cell / 2 - cell, 3, 0, 7); x.fill();
  }
  return tex(c);
}
/** glossy white subway tile with grout */
export function subway(tile = '#f6fbf8', grout = '#cfe3da', n = 512) {
  const [c, x] = canvas(n); x.fillStyle = grout; x.fillRect(0, 0, n, n);
  const w = n / 4, h = n / 8;
  for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
    const x0 = k * w + (r % 2 ? w / 2 : 0) + 3, y0 = r * h + 3;
    const g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, tile); g.addColorStop(1, '#e4efe9');
    x.fillStyle = g; x.beginPath(); x.roundRect(x0, y0, w - 6, h - 6, 6); x.fill();
  }
  return tex(c);
}
/** soft gingham check */
export function gingham(col = '#9ccfa6', bg = '#fffaf0', n = 512, k = 8) {
  const [c, x] = canvas(n); x.fillStyle = bg; x.fillRect(0, 0, n, n);
  const s = n / k; const C = new THREE.Color(col);
  const rgba = a => `rgba(${C.r * 255 | 0},${C.g * 255 | 0},${C.b * 255 | 0},${a})`;
  for (let i = 0; i < k; i += 2) { x.fillStyle = rgba(0.45); x.fillRect(i * s, 0, s, n); x.fillRect(0, i * s, n, s); }
  for (let i = 0; i < k; i += 2) for (let j = 0; j < k; j += 2) { x.fillStyle = rgba(0.5); x.fillRect(i * s, j * s, s, s); }
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(255,255,255,${R(0, 0.08)})`; x.fillRect(R(0, n), R(0, n), 2, 2); }
  return tex(c);
}
/** striped room wallpaper with tiny flowers */
export function wallpaper(a = '#ffe3d3', b = '#ffd2c0', dot = '#ffc75f', n = 512) {
  const [c, x] = canvas(n); const w = n / 8;
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * w, 0, w, n); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    const cx = i * w + w / 2, cy = j * (n / 6) + (i % 2 ? n / 12 : 0) + 20;
    x.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 5; k++) { const a2 = k / 5 * Math.PI * 2; x.beginPath(); x.arc(cx + Math.cos(a2) * 5, cy + Math.sin(a2) * 5, 3.8, 0, 7); x.fill(); }
    x.fillStyle = dot; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill();
  }
  return tex(c);
}
/** herringbone floor */
export function herring(base = '#d9a774', n = 512) {
  const [c, x] = canvas(n); x.fillStyle = base; x.fillRect(0, 0, n, n);
  const L = n / 4, W = L / 3;
  for (let i = -2; i < 10; i++) for (let j = -2; j < 10; j++) {
    const ox = i * L / 2 * 2, oy = j * W * 2 + i * W;
    for (const flip of [0, 1]) {
      x.save(); x.translate(ox + (flip ? W : 0), oy + (flip ? 0 : 0)); x.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
      const t = R(-0.08, 0.08); x.fillStyle = t > 0 ? `rgba(255,235,205,${t})` : `rgba(90,50,20,${-t})`; x.fillRect(0, 0, L, W);
      x.strokeStyle = 'rgba(80,40,15,.35)'; x.lineWidth = 1.5; x.strokeRect(0, 0, L, W); x.restore();
    }
  }
  return tex(c);
}
/** shop sign: a painted name on a board */
export function sign(text, bg = '#ff8fb0', fg = '#fff', edge = '#5b2a4e', w = 1024, h = 256) {
  const [c, x] = canvas(w, h);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, new THREE.Color(bg).offsetHSL(0, 0, 0.06).getStyle()); g.addColorStop(1, bg);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 8; x.setLineDash([2, 18]); x.lineCap = 'round'; x.strokeRect(22, 22, w - 44, h - 44); x.setLineDash([]);
  x.font = `800 ${h * 0.56}px "Baloo 2", "Fredoka", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 16; x.strokeStyle = edge; x.lineJoin = 'round'; x.strokeText(text, w / 2, h * 0.56);
  x.fillStyle = fg; x.fillText(text, w / 2, h * 0.56);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** scalloped paper edge strip (shelf liner) */
export function scallop(col = '#ffffff', n = 256) {
  const [c, x] = canvas(n, 64); x.clearRect(0, 0, n, 64); x.fillStyle = col;
  x.fillRect(0, 0, n, 30); for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(i * n / 8 + n / 16, 30, n / 16, 0, Math.PI); x.fill(); }
  x.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(i * n / 8 + n / 16, 26, 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** soft round shadow blob */
export function blob(n = 128, a = 0.45) {
  const [c, x] = canvas(n), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  return new THREE.CanvasTexture(c);
}
/** additive sparkle star sprite */
export function starSprite() {
  const [c, x] = canvas(64); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath();
  x.moveTo(32, 2); x.lineTo(36, 28); x.lineTo(62, 32); x.lineTo(36, 36); x.lineTo(32, 62); x.lineTo(28, 36); x.lineTo(2, 32); x.lineTo(28, 28); x.closePath(); x.fill();
  return new THREE.CanvasTexture(c);
}

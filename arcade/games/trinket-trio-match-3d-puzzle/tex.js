// Canvas-painted textures for the room and the trinket box (no image files): quilted velvet, warm wood, wallpaper.
import { THREE } from './kit/hc.js';

const canvas = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; };
const tex = (c, rep = 1, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

/** quilted velvet lining: colour map + bump map. cells = diamonds across */
export function quilt(c1, c2, cells = 6, n = 512) {
  const [c, x] = canvas(n), [b, y] = canvas(n), s = n / cells;
  const A = new THREE.Color(c1), Bc = new THREE.Color(c2);
  const ci = x.createImageData(n, n), bi = y.createImageData(n, n), d = ci.data, e = bi.data;
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const u = (px + py) / s, v = (px - py + n) / s, fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
    const edge = Math.max(Math.abs(fu), Math.abs(fv)) * 2;                 // 0 centre → 1 seam
    const puff = Math.pow(1 - edge, 0.55), lightDir = (-fu - fv) * 0.35;  // soft highlight up-left
    const k = 0.72 + 0.32 * puff + lightDir * puff + (Math.random() - 0.5) * 0.05, t = py / n;
    const i = (py * n + px) * 4;
    d[i] = Math.min(255, (A.r * (1 - t) + Bc.r * t) * 255 * k); d[i + 1] = Math.min(255, (A.g * (1 - t) + Bc.g * t) * 255 * k); d[i + 2] = Math.min(255, (A.b * (1 - t) + Bc.b * t) * 255 * k); d[i + 3] = 255;
    const h = puff * 255; e[i] = e[i + 1] = e[i + 2] = h; e[i + 3] = 255;
  }
  x.putImageData(ci, 0, 0); y.putImageData(bi, 0, 0);
  // stitched seams + pearl buttons where they cross
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1.5; x.setLineDash([5, 5]);
  for (let i = -cells; i <= cells * 2; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s + n, n); x.stroke(); x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s - n, n); x.stroke(); }
  x.setLineDash([]);
  for (let i = 0; i <= cells * 2; i++) for (let j = 0; j <= cells * 2; j++) {
    if ((i + j) % 2) continue; const px = i * s / 2, py = j * s / 2;
    x.fillStyle = 'rgba(60,30,50,0.25)'; x.beginPath(); x.arc(px + 1, py + 2, 5, 0, 7); x.fill();
    const g = x.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, 5); g.addColorStop(0, '#fff'); g.addColorStop(1, '#f3dcc4');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, 4.2, 0, 7); x.fill();
  }
  return { map: tex(c), bump: tex(b, 1, false) };
}
function diamond(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy - s / 2); x.lineTo(cx + s / 2, cy); x.lineTo(cx, cy + s / 2); x.lineTo(cx - s / 2, cy); x.closePath(); }

/** warm wood planks */
export function wood(base = '#c98a5a', n = 1024, planks = 6) {
  const [c, x] = canvas(n); x.fillStyle = base; x.fillRect(0, 0, n, n);
  const h = n / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * h, tint = (Math.random() - 0.5) * 0.12;
    x.fillStyle = tint > 0 ? `rgba(255,230,200,${tint})` : `rgba(80,40,20,${-tint})`; x.fillRect(0, y0, n, h);
    for (let k = 0; k < 26; k++) {
      x.strokeStyle = `rgba(${Math.random() < 0.5 ? '90,50,25' : '255,220,180'},${0.05 + Math.random() * 0.08})`; x.lineWidth = 1 + Math.random() * 2.5;
      x.beginPath(); let yy = y0 + Math.random() * h; x.moveTo(0, yy);
      for (let xx = 0; xx <= n; xx += 32) { yy += (Math.random() - 0.5) * 3; x.lineTo(xx, Math.max(y0 + 2, Math.min(y0 + h - 2, yy))); }
      x.stroke();
    }
    x.fillStyle = 'rgba(60,30,15,0.45)'; x.fillRect(0, y0, n, 3);
    x.fillStyle = 'rgba(255,230,200,0.25)'; x.fillRect(0, y0 + 3, n, 2);
    const cut = Math.random() * n; x.fillStyle = 'rgba(60,30,15,0.35)'; x.fillRect(cut, y0, 3, h);
  }
  return tex(c);
}

/** striped wallpaper with tiny flowers */
export function wallpaper(a = '#ffe3d3', b = '#ffd2c0', n = 512) {
  const [c, x] = canvas(n); const w = n / 8;
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * w, 0, w, n); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    const cx = i * w + w / 2, cy = j * (n / 6) + (i % 2 ? n / 12 : 0) + 20;
    x.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = 0; k < 5; k++) { const a2 = k / 5 * Math.PI * 2; x.beginPath(); x.arc(cx + Math.cos(a2) * 6, cy + Math.sin(a2) * 6, 4.5, 0, 7); x.fill(); }
    x.fillStyle = '#ffc75f'; x.beginPath(); x.arc(cx, cy, 3.5, 0, 7); x.fill();
  }
  return tex(c);
}

/** soft round shadow blob (for décor contact shadows) */
export function blob(n = 128) {
  const [c, x] = canvas(n), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c); return t;
}

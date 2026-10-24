// Bubble Buns code-drawn art: kawaii face + colour-blind shape-mark atlas for the jelly bubbles, jelly gloss texture,
// the tufted cushion behind the board, the dreamy lilac background, wallpaper and floor for the burrow rooms.
import { THREE } from './kit/hc.js';
import { COLORS, MARKS } from './levels.js';

const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const shade = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color(k < 0 ? '#2a0f3a' : '#ffffff'), Math.abs(k)).getHexString();

// ------------------------------------------------------------ shape marks (also used by the DOM: svg paths in a 0..100 box)
export function markPath(x, kind, cx, cy, s) {   // s = radius-ish
  x.beginPath();
  if (kind === 'heart') { x.moveTo(cx, cy + s * 0.85); x.bezierCurveTo(cx - s * 1.25, cy - s * 0.05, cx - s * 0.65, cy - s * 1.05, cx, cy - s * 0.42); x.bezierCurveTo(cx + s * 0.65, cy - s * 1.05, cx + s * 1.25, cy - s * 0.05, cx, cy + s * 0.85); }
  else if (kind === 'drop') { x.moveTo(cx, cy - s); x.bezierCurveTo(cx + s * 0.35, cy - s * 0.45, cx + s * 0.8, cy, cx + s * 0.8, cy + s * 0.3); x.arc(cx, cy + s * 0.3, s * 0.8, 0, Math.PI); x.bezierCurveTo(cx - s * 0.8, cy, cx - s * 0.35, cy - s * 0.45, cx, cy - s); }
  else if (kind === 'clover') { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; x.moveTo(cx + Math.cos(a) * s * 0.48 + s * 0.42, cy + Math.sin(a) * s * 0.48); x.arc(cx + Math.cos(a) * s * 0.48, cy + Math.sin(a) * s * 0.48, s * 0.42, 0, Math.PI * 2); } }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; i ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); }
  else if (kind === 'moon') { x.arc(cx, cy, s * 0.9, Math.PI * 0.32, Math.PI * 1.68); x.arc(cx + s * 0.5, cy - s * 0.12, s * 0.62, Math.PI * 1.5, Math.PI * 0.62, true); x.closePath(); }
  else if (kind === 'flower') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; x.moveTo(cx + Math.cos(a) * s * 0.55 + s * 0.42, cy + Math.sin(a) * s * 0.55); x.arc(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55, s * 0.42, 0, Math.PI * 2); } }
}
/** a small DOM-ready data URL of a shape mark (white on the jelly colour) */
export function markIcon(i, size = 40) {
  const [c, x] = canvas(size, size);
  x.fillStyle = COLORS[i]; x.beginPath(); x.arc(size / 2, size / 2, size / 2 - 1, 0, 7); x.fill();
  x.fillStyle = '#fff'; markPath(x, MARKS[i], size / 2, size / 2 + 1, size * 0.3); x.fill('nonzero');
  return c.toDataURL();
}

// ------------------------------------------------------------ face atlas: 6 colours × 3 expressions (open, blink, joy)
// cell (col, row): col = colour, row 0 open eyes, 1 blink, 2 happy ^^ (used for the launcher + combos)
export const FACE_ROWS = 3;
export function faceAtlas(marks = true) {
  const S = 160, [c, x] = canvas(S * 6, S * FACE_ROWS);
  for (let col = 0; col < 6; col++) for (let row = 0; row < FACE_ROWS; row++) {
    const ox = col * S, oy = row * S, cx = ox + S / 2, cy = oy + S / 2, ink = shade(COLORS[col], -0.72);
    // blush
    for (const sx of [-1, 1]) { const g = x.createRadialGradient(cx + sx * 34, cy + 20, 2, cx + sx * 34, cy + 20, 17); g.addColorStop(0, 'rgba(255,90,140,.75)'); g.addColorStop(1, 'rgba(255,90,140,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx + sx * 34, cy + 20, 18, 11, 0, 0, 7); x.fill(); }
    x.fillStyle = ink; x.strokeStyle = ink; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const sx of [-1, 1]) {
      const ex = cx + sx * 24, ey = cy + 4;
      if (row === 0) {
        x.beginPath(); x.ellipse(ex, ey, 8.5, 11.5, 0, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(ex - 2.6, ey - 4.4, 3.6, 0, 7); x.fill(); x.beginPath(); x.arc(ex + 3, ey + 4, 1.7, 0, 7); x.fill(); x.fillStyle = ink;
      } else if (row === 1) { x.lineWidth = 5; x.beginPath(); x.moveTo(ex - 8, ey + 2); x.quadraticCurveTo(ex, ey + 8, ex + 8, ey + 2); x.stroke(); }
      else { x.lineWidth = 5.5; x.beginPath(); x.moveTo(ex - 8, ey + 4); x.quadraticCurveTo(ex, ey - 8, ex + 8, ey + 4); x.stroke(); }
    }
    // mouth: tiny cat "w" (open) / smile (joy)
    x.lineWidth = 4.2;
    if (row === 2) { x.beginPath(); x.moveTo(cx - 8, cy + 18); x.quadraticCurveTo(cx, cy + 30, cx + 8, cy + 18); x.closePath(); x.fillStyle = '#c2185b'; x.fill(); x.fillStyle = ink; }
    else { x.beginPath(); x.moveTo(cx - 8, cy + 18); x.quadraticCurveTo(cx - 4, cy + 24, cx, cy + 18); x.quadraticCurveTo(cx + 4, cy + 24, cx + 8, cy + 18); x.stroke(); }
    // shape mark: a white sticker shape low on the right cheek, outlined in the jelly's deep tone
    if (marks) {
      const mx = cx + 44, my = cy + 46, ms = 15;
      x.save(); x.lineWidth = 6; x.strokeStyle = shade(COLORS[col], -0.35); markPath(x, MARKS[col], mx, my, ms); x.stroke(); x.fillStyle = '#ffffff'; markPath(x, MARKS[col], mx, my, ms); x.fill('nonzero'); x.restore();
    }
  }
  const t = tex(c); t.generateMipmaps = true; return t;
}

// soft gradient for the jelly body: bright candy core, deeper rim + a faint inner swirl
export function jellyTex() {
  const [c, x] = canvas(256, 128);
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(0.42, '#f6f6f6'); g.addColorStop(1, '#9c9c9c'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.globalAlpha = 0.12; x.strokeStyle = '#fff'; x.lineWidth = 8; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(i * 48 - 20, 0); x.bezierCurveTo(i * 48 + 10, 40, i * 48 - 30, 80, i * 48 + 5, 128); x.stroke(); }
  return tex(c);
}

// tufted lilac cushion behind the field (the mockup's quilted pouf), with button tufts
export function cushionTex(w = 512, h = 860) {
  const [c, x] = canvas(w, h);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e4c8ff'); g.addColorStop(0.5, '#f1c9f3'); g.addColorStop(1, '#ffd2ea'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const step = 74;
  for (let yy = -step; yy < h + step; yy += step) for (let xx = -step; xx < w + step; xx += step) {
    const ox = ((yy / step) & 1) ? step / 2 : 0, px = xx + ox, py = yy;
    const rg = x.createRadialGradient(px, py + step / 2, 4, px, py + step / 2, step * 0.62); rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(px - step, py, step * 2, step);
  }
  x.strokeStyle = 'rgba(190,110,210,.32)'; x.lineWidth = 3;
  for (let k = -h; k < w + h; k += step) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + h * 0.5, h); x.stroke(); x.beginPath(); x.moveTo(k, 0); x.lineTo(k - h * 0.5, h); x.stroke(); }
  for (let yy = 0; yy < h + step; yy += step) for (let xx = 0; xx < w + step; xx += step) {
    const ox = ((yy / step) & 1) ? step / 2 : 0; x.fillStyle = 'rgba(160,110,210,.45)'; x.beginPath(); x.arc(xx + ox, yy, 5, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(xx + ox - 1.5, yy - 1.5, 2, 0, 7); x.fill();
  }
  return tex(c);
}

// dreamy background: lilac → bubblegum, bokeh, twinkles, tiny hearts
export function skyTex(top = '#b48cf0', mid = '#e7b6f4', bot = '#ffd3ea') {
  const [c, x] = canvas(512, 1024);
  const g = x.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 512, 1024);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) { const px = r() * 512, py = r() * 1024, rad = 10 + r() * 46, gg = x.createRadialGradient(px, py, 0, px, py, rad); gg.addColorStop(0, `rgba(255,255,255,${0.12 + r() * 0.22})`); gg.addColorStop(0.7, 'rgba(255,255,255,0.05)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gg; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill(); }
  for (let i = 0; i < 40; i++) { const px = r() * 512, py = r() * 1024, sz = 2 + r() * 5; x.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? sz * 0.3 : sz; k ? x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : x.moveTo(px + rr, py); } x.fill(); }
  for (let i = 0; i < 14; i++) { const px = r() * 512, py = r() * 1024, sz = 5 + r() * 7; x.fillStyle = `rgba(255,${120 + (r() * 80) | 0},${190 + (r() * 50) | 0},.45)`; markPath(x, 'heart', px, py, sz); x.fill(); }
  return tex(c);
}

// burrow room surfaces
export function wallpaperTex(base = '#ffd9ea', dot = '#ffffff', stripe = '#ffc6df') {
  const [c, x] = canvas(256, 256);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  x.fillStyle = stripe; for (let i = 0; i < 256; i += 64) x.fillRect(i, 0, 26, 256);
  x.fillStyle = dot; for (let yy = 16; yy < 256; yy += 32) for (let xx = (yy / 32 & 1) ? 16 : 0; xx < 256; xx += 32) { x.globalAlpha = 0.75; markPath(x, 'heart', xx + 8, yy, 5); x.fill(); }
  x.globalAlpha = 1; const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function floorTex(a = '#f3d9ff', b = '#e6c7fb') {
  const [c, x] = canvas(256, 256);
  for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = (xx + yy) & 1 ? a : b; x.fillRect(xx * 64, yy * 64, 64, 64); }
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function stripeTex(a = '#ff7eb6', b = '#ffffff', n = 8) {   // candy stripes (launcher barrel, ceiling bar)
  const [c, x] = canvas(256, 64);
  x.fillStyle = b; x.fillRect(0, 0, 256, 64); x.fillStyle = a;
  for (let i = -2; i < n * 2; i++) { x.beginPath(); x.moveTo(i * 256 / n, 0); x.lineTo(i * 256 / n + 256 / n / 2, 0); x.lineTo(i * 256 / n + 256 / n / 2 + 32, 64); x.lineTo(i * 256 / n + 32, 64); x.fill(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

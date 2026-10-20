// Keepsake Lane — rooms built in code: floors, wallpaper, wainscoting, windows with warm light shafts and dust,
// curtains, rugs, shelves, side tables, book stacks, frames. Every texture is drawn on a canvas (no image files).
import { THREE } from './kit/hc.js';

const TAU = Math.PI * 2;
const CACHE = new Map();
function canvasTex(key, w, h, draw, { repeat = null, srgb = true, aniso = 8 } = {}) {
  if (CACHE.has(key)) return CACHE.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  CACHE.set(key, t); return t;
}
// small seeded rand for textures so every room looks the same each visit
function srand(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296); }
const hex = (c, a = 1) => { const v = new THREE.Color(c); return `rgba(${(v.r * 255) | 0},${(v.g * 255) | 0},${(v.b * 255) | 0},${a})`; };
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

// ---------------------------------------------------------------- textures
export function woodFloor(base = '#c98f55', key = 'wood') {
  return canvasTex('floor' + key + base, 1024, 1024, (x, w, h) => {
    const r = srand(7), n = 7, pw = w / n;
    for (let i = 0; i < n; i++) {
      let y = -r() * h;
      while (y < h) {
        const len = h * (0.45 + r() * 0.5), k = 0.82 + r() * 0.3;
        x.fillStyle = shade(base, k); x.fillRect(i * pw, y, pw, len);
        for (let g = 0; g < 26; g++) { // grain
          x.strokeStyle = hex(shade(base, 0.6 + r() * 0.3), 0.18 + r() * 0.18); x.lineWidth = 0.6 + r() * 1.6; x.beginPath();
          const gx = i * pw + r() * pw; x.moveTo(gx, y); x.bezierCurveTo(gx + (r() - 0.5) * 18, y + len * 0.3, gx + (r() - 0.5) * 18, y + len * 0.7, gx + (r() - 0.5) * 10, y + len); x.stroke();
        }
        if (r() < 0.35) { x.fillStyle = hex(shade(base, 0.55), 0.35); x.beginPath(); x.ellipse(i * pw + r() * pw, y + r() * len, 4 + r() * 6, 8 + r() * 10, 0, 0, TAU); x.fill(); }
        x.fillStyle = 'rgba(40,20,8,.55)'; x.fillRect(i * pw, y, pw, 3);
        y += len;
      }
      x.fillStyle = 'rgba(40,20,8,.5)'; x.fillRect(i * pw, 0, 3, h);
    }
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,240,210,.06)'); g.addColorStop(1, 'rgba(0,0,0,.06)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}
export function tileFloor(a = '#f4ead6', b = '#d98b6a') {
  return canvasTex('tile' + a + b, 512, 512, (x, w, h) => {
    const n = 4, s = w / n, r = srand(3);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      x.fillStyle = shade((i + j) % 2 ? a : b, 0.94 + r() * 0.1); x.fillRect(i * s, j * s, s, s);
      const g = x.createLinearGradient(i * s, j * s, i * s + s, j * s + s); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.08)'); x.fillStyle = g; x.fillRect(i * s, j * s, s, s);
    }
    x.strokeStyle = 'rgba(120,100,80,.6)'; x.lineWidth = 4; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); }
  });
}
export function stoneFloor() {
  return canvasTex('stone', 1024, 1024, (x, w, h) => {
    const r = srand(11); x.fillStyle = '#9b8f7d'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 7; j++) { let px = -r() * 80; const sh = h / 7; while (px < w) { const sw = 110 + r() * 120; x.fillStyle = shade(['#d8cbb2', '#cbbd9f', '#e2d6c0', '#c4b496'][(r() * 4) | 0], 0.92 + r() * 0.12);
      x.beginPath(); x.roundRect(px + 5, j * sh + 5, sw - 10, sh - 10, 18); x.fill();
      x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.roundRect(px + 9, j * sh + 8, sw - 18, (sh - 16) * 0.4, 12); x.fill(); px += sw; } }
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,50,40'},${0.04 + r() * 0.08})`; x.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); }
    for (let i = 0; i < 60; i++) { x.fillStyle = hex('#6f9a4a', 0.5); x.beginPath(); x.arc(r() * w, ((r() * 7) | 0) * h / 7, 3 + r() * 6, 0, TAU); x.fill(); }
  });
}
export function grassTex() {
  return canvasTex('grass', 512, 512, (x, w, h) => {
    const r = srand(5); x.fillStyle = '#7fb24f'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { x.strokeStyle = hex(['#6aa040', '#8cc25a', '#9fcf63', '#5d9138'][(r() * 4) | 0], 0.7); x.lineWidth = 1.5; const px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py - 6 - r() * 6); x.stroke(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = ['#fff', '#ffe36e', '#ffb3c8'][(r() * 3) | 0]; x.beginPath(); x.arc(r() * w, r() * h, 2.5, 0, TAU); x.fill(); }
  });
}
// wallpaper tile, 512², drawn so it repeats seamlessly
export function wallpaper(kind, bg, fg, ac) {
  return canvasTex(`wp${kind}${bg}${fg}${ac}`, 512, 512, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const r = srand(kind.length * 31 + 7);
    const at = (fn) => { for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h], [w, h], [-w, -h], [w, -h], [-w, h]]) { x.save(); x.translate(ox, oy); fn(); x.restore(); } };
    if (kind === 'stripe') {
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? hex(fg, 0.55) : hex(ac, 0.22); x.fillRect(i * w / 8, 0, w / 16 + (i % 2) * 8, h); }
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) rose(x, i * w / 4 + w / 8 + (j % 2) * w / 8, j * h / 4 + h / 8, 9, ac, fg);
    } else if (kind === 'damask') {
      const motif = (cx, cy, s) => { x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = hex(fg, 0.85);
        x.beginPath(); x.moveTo(0, -70); x.bezierCurveTo(40, -40, 50, 0, 0, 70); x.bezierCurveTo(-50, 0, -40, -40, 0, -70); x.fill();
        x.fillStyle = bg; x.beginPath(); x.moveTo(0, -40); x.bezierCurveTo(20, -20, 24, 10, 0, 40); x.bezierCurveTo(-24, 10, -20, -20, 0, -40); x.fill();
        x.fillStyle = hex(fg, 0.85); for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(sx * 42, -6, 14, 30, sx * 0.5, 0, TAU); x.fill(); x.beginPath(); x.arc(sx * 30, 52, 9, 0, TAU); x.fill(); }
        x.beginPath(); x.arc(0, -84, 8, 0, TAU); x.fill(); x.fillStyle = hex(ac, 0.9); x.beginPath(); x.arc(0, 0, 9, 0, TAU); x.fill(); x.restore(); };
      at(() => { motif(w / 4, h / 4, 0.95); motif(w * 3 / 4, h * 3 / 4, 0.95); });
      at(() => { x.fillStyle = hex(fg, 0.45); for (const [a, b] of [[w * 3 / 4, h / 4], [w / 4, h * 3 / 4]]) { x.beginPath(); x.arc(a, b, 6, 0, TAU); x.fill(); } });
    } else if (kind === 'floral') {
      for (let i = 0; i < 26; i++) { const px = r() * w, py = r() * h; at(() => { leafSprig(x, px, py, 18, fg); rose(x, px, py, 11 + r() * 5, ac, fg); }); }
      for (let i = 0; i < 60; i++) { const px = r() * w, py = r() * h; at(() => { x.fillStyle = hex(fg, 0.5); x.beginPath(); x.arc(px, py, 2.5, 0, TAU); x.fill(); }); }
    } else if (kind === 'trellis') {
      x.strokeStyle = hex(fg, 0.7); x.lineWidth = 5;
      for (let i = -2; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 2, 0); x.lineTo(i * w / 2 + w, h); x.stroke(); x.beginPath(); x.moveTo(i * w / 2 + w, 0); x.lineTo(i * w / 2, h); x.stroke(); }
      for (const [a, b] of [[0, h / 2], [w / 2, 0], [w / 2, h], [w, h / 2], [0, 0], [w, 0], [0, h], [w, h]]) { at(() => { x.fillStyle = hex(ac, 0.85); x.beginPath(); x.arc(a, b, 10, 0, TAU); x.fill(); x.fillStyle = hex('#fff', 0.6); x.beginPath(); x.arc(a - 3, b - 3, 3, 0, TAU); x.fill(); }); }
      for (const [a, b] of [[w / 4, h / 4], [w * 3 / 4, h * 3 / 4], [w * 3 / 4, h / 4], [w / 4, h * 3 / 4]]) leafSprig(x, a, b, 14, fg);
    } else if (kind === 'planks') {
      const n = 6, ph = h / n; for (let i = 0; i < n; i++) { x.fillStyle = shade(bg, 0.85 + r() * 0.25); x.fillRect(0, i * ph, w, ph); x.fillStyle = 'rgba(50,25,10,.45)'; x.fillRect(0, i * ph, w, 3);
        for (let g = 0; g < 14; g++) { x.strokeStyle = hex(shade(bg, 0.6), 0.25); x.lineWidth = 1; x.beginPath(); const gy = i * ph + r() * ph; x.moveTo(0, gy); x.bezierCurveTo(w * 0.3, gy + (r() - 0.5) * 10, w * 0.6, gy + (r() - 0.5) * 10, w, gy); x.stroke(); }
        for (let k = 0; k < 2; k++) { x.fillStyle = 'rgba(60,40,30,.6)'; x.beginPath(); x.arc(((r() * 4) | 0) * w / 4 + 20, i * ph + ph / 2, 3, 0, TAU); x.fill(); } }
    } else if (kind === 'brick') {
      const rows = 10, bh = h / rows, bw = w / 4; x.fillStyle = '#d9c8b4'; x.fillRect(0, 0, w, h);
      for (let j = 0; j < rows; j++) for (let i = -1; i < 5; i++) { x.fillStyle = shade(['#b4553f', '#c4664a', '#a94c39', '#c97a5a'][(r() * 4) | 0], 0.92 + r() * 0.15);
        x.beginPath(); x.roundRect(i * bw + (j % 2) * bw / 2 + 3, j * bh + 3, bw - 6, bh - 6, 4); x.fill(); }
    }
    // soft print noise
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + r() * 0.03})`; x.fillRect(r() * w, r() * h, 2, 2); }
  }, { repeat: null });
}
function rose(x, cx, cy, s, c, leaf) {
  x.fillStyle = hex(leaf, 0.8); for (const a of [-0.6, 0.6 + Math.PI]) { x.beginPath(); x.ellipse(cx + Math.cos(a) * s * 1.1, cy + Math.sin(a) * s * 0.9, s * 0.7, s * 0.32, a, 0, TAU); x.fill(); }
  x.fillStyle = c; x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, cy, s * 0.62, 0.5, 5.2); x.stroke(); x.beginPath(); x.arc(cx + 1, cy - 1, s * 0.3, 2, 7.5); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.arc(cx - s * 0.35, cy - s * 0.35, s * 0.3, 0, TAU); x.fill();
}
function leafSprig(x, cx, cy, s, c) {
  x.strokeStyle = hex(c, 0.7); x.lineWidth = 2; x.beginPath(); x.moveTo(cx - s * 1.6, cy + s); x.quadraticCurveTo(cx, cy, cx + s * 1.6, cy - s); x.stroke();
  x.fillStyle = hex(c, 0.7); for (let k = -2; k <= 2; k++) { if (!k) continue; x.beginPath(); x.ellipse(cx + k * s * 0.6, cy - k * s * 0.38 + (k % 2 ? 5 : -5), s * 0.42, s * 0.18, -0.6, 0, TAU); x.fill(); }
}
export function wainscotTex(c) {
  return canvasTex('wain' + c, 512, 512, (x, w, h) => {
    x.fillStyle = c; x.fillRect(0, 0, w, h);
    const m = 40; x.fillStyle = shade(c, 0.86); x.fillRect(m, m, w - 2 * m, h - 2 * m);
    x.fillStyle = shade(c, 1.08); x.fillRect(m + 12, m + 12, w - 2 * m - 24, h - 2 * m - 24);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(m, m, w - 2 * m, 4); x.fillRect(m, m, 4, h - 2 * m);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(m, h - m - 4, w - 2 * m, 4); x.fillRect(w - m - 4, m, 4, h - 2 * m);
    x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(m + 12, m + 12, w - 2 * m - 24, 3); x.fillRect(m + 12, m + 12, 3, h - 2 * m - 24);
  });
}
export function rugTex(a, b, c, key = 'r') {
  return canvasTex('rug' + key + a + b + c, 1024, 640, (x, w, h) => {
    const r = srand(17); x.fillStyle = a; x.fillRect(0, 0, w, h);
    x.strokeStyle = b; x.lineWidth = 26; x.strokeRect(30, 30, w - 60, h - 60);
    x.strokeStyle = c; x.lineWidth = 6; x.strokeRect(58, 58, w - 116, h - 116); x.strokeRect(14, 14, w - 28, h - 28);
    for (let i = 0; i < 26; i++) { const px = 70 + i * (w - 140) / 25; for (const py of [30, h - 30]) { x.fillStyle = c; x.beginPath(); x.moveTo(px, py - 10); x.lineTo(px + 10, py); x.lineTo(px, py + 10); x.lineTo(px - 10, py); x.fill(); } }
    for (let i = 0; i < 16; i++) { const py = 70 + i * (h - 140) / 15; for (const px of [30, w - 30]) { x.fillStyle = c; x.beginPath(); x.moveTo(px, py - 10); x.lineTo(px + 10, py); x.lineTo(px, py + 10); x.lineTo(px - 10, py); x.fill(); } }
    const cx = w / 2, cy = h / 2;
    for (let k = 5; k >= 1; k--) { x.fillStyle = k % 2 ? b : c; x.beginPath(); for (let i = 0; i <= 16; i++) { const an = i / 16 * TAU, rr = (k * 40) * (i % 2 ? 0.82 : 1); x.lineTo(cx + Math.cos(an) * rr * 1.5, cy + Math.sin(an) * rr); } x.fill(); }
    x.fillStyle = a; x.beginPath(); x.arc(cx, cy, 22, 0, TAU); x.fill();
    for (const [px, py] of [[150, 140], [w - 150, 140], [150, h - 140], [w - 150, h - 140]]) { x.fillStyle = b; x.beginPath(); for (let i = 0; i <= 8; i++) { const an = i / 8 * TAU; x.lineTo(px + Math.cos(an) * 46, py + Math.sin(an) * 46); } x.fill(); x.fillStyle = c; x.beginPath(); x.arc(px, py, 16, 0, TAU); x.fill(); }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.05})`; x.fillRect(r() * w, r() * h, 2, 3); }
  });
}
function outsideTex(night = false) {
  return canvasTex('outside', 512, 512, (x, w, h) => {
    const r = srand(23), g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8fd0ff'); g.addColorStop(0.55, '#fff0c8'); g.addColorStop(1, '#ffe3a8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 5; i++) { const cx = r() * w, cy = 40 + r() * 120; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(cx + k * 22 - 44, cy + Math.sin(k) * 8, 22 + r() * 14, 0, TAU); x.fill(); } }
    x.fillStyle = '#a7d47a'; x.beginPath(); x.moveTo(0, h * 0.62); for (let i = 0; i <= 10; i++) x.lineTo(i * w / 10, h * 0.6 - Math.sin(i * 0.9) * 26); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    for (let i = 0; i < 9; i++) { const tx = r() * w, ty = h * 0.6 + r() * 30, s = 34 + r() * 34; x.fillStyle = ['#5e9c4a', '#76b35a', '#4f8a3f'][(r() * 3) | 0]; x.beginPath(); x.arc(tx, ty - s * 0.6, s, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,220,.25)'; x.beginPath(); x.arc(tx - s * 0.3, ty - s * 0.9, s * 0.45, 0, TAU); x.fill(); }
    x.fillStyle = '#86c35f'; x.fillRect(0, h * 0.8, w, h * 0.2);
    for (let i = 0; i < 90; i++) { x.fillStyle = ['#ff8fb1', '#ffe066', '#ffffff', '#c39bff'][(r() * 4) | 0]; x.beginPath(); x.arc(r() * w, h * 0.8 + r() * h * 0.2, 4, 0, TAU); x.fill(); }
    const s = x.createRadialGradient(w * 0.8, h * 0.25, 5, w * 0.8, h * 0.25, 140); s.addColorStop(0, 'rgba(255,250,220,1)'); s.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = s; x.fillRect(0, 0, w, h);
  }, { aniso: 1 });
}
function fabricTex(c) {
  return canvasTex('fab' + c, 256, 256, (x, w, h) => {
    for (let i = 0; i < w; i++) { const k = 0.78 + 0.22 * Math.sin(i / w * TAU * 4) ** 2; x.fillStyle = shade(c, k); x.fillRect(i, 0, 1, h); }
    const r = srand(9); for (let i = 0; i < 1000; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.05})`; x.fillRect(r() * w, r() * h, 1, 3); }
  });
}
export function glowTex() {
  return canvasTex('glow', 128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,240,200,.55)'); g.addColorStop(1, 'rgba(255,220,160,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, { aniso: 1 });
}
function paintingTex(kind) {
  return canvasTex('paint' + kind, 256, 320, (x, w, h) => {
    const r = srand(kind * 13 + 1);
    if (kind === 0) { // flowers in a vase
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3c4a6b'); g.addColorStop(1, '#22293d'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#c99b5a'; x.beginPath(); x.ellipse(w / 2, h * 0.78, 40, 55, 0, 0, TAU); x.fill();
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.2, d = 50 + r() * 60; x.fillStyle = ['#ff7aa2', '#ffd166', '#fff3e0', '#ff9f68', '#c77dff'][(r() * 5) | 0]; x.beginPath(); x.arc(w / 2 + Math.cos(a) * d, h * 0.55 + Math.sin(a) * d, 14 + r() * 10, 0, TAU); x.fill(); }
    } else if (kind === 1) { // seaside
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffcf9e'); g.addColorStop(0.5, '#ffe9c9'); g.addColorStop(0.52, '#5aa9c9'); g.addColorStop(1, '#2f6f8f'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff4d9'; x.beginPath(); x.arc(w * 0.65, h * 0.38, 30, 0, TAU); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(70, h * 0.5); x.lineTo(110, h * 0.5); x.lineTo(90, h * 0.3); x.fill(); x.fillStyle = '#7a4b2a'; x.fillRect(60, h * 0.5, 60, 10);
    } else if (kind === 2) { // portrait of a lady (simple)
      x.fillStyle = '#5d6b4a'; x.fillRect(0, 0, w, h); x.fillStyle = '#8a3b4f'; x.beginPath(); x.ellipse(w / 2, h, 90, 120, 0, 0, TAU); x.fill();
      x.fillStyle = '#f2c9a5'; x.beginPath(); x.ellipse(w / 2, h * 0.42, 40, 50, 0, 0, TAU); x.fill(); x.fillStyle = '#e8e2d8'; x.beginPath(); x.ellipse(w / 2, h * 0.32, 48, 34, 0, Math.PI, TAU); x.fill();
      x.fillStyle = '#3b2a20'; x.fillRect(w / 2 - 16, h * 0.42, 6, 5); x.fillRect(w / 2 + 10, h * 0.42, 6, 5); x.fillStyle = '#c2566b'; x.fillRect(w / 2 - 8, h * 0.5, 16, 4);
    } else { // meadow
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd3ff'); g.addColorStop(0.6, '#e9f7ff'); g.addColorStop(0.61, '#9ccc65'); g.addColorStop(1, '#5f9e3a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { x.fillStyle = ['#ff6b8b', '#ffd23f', '#fff'][(r() * 3) | 0]; x.beginPath(); x.arc(r() * w, h * 0.65 + r() * h * 0.35, 3 + r() * 3, 0, TAU); x.fill(); }
      x.fillStyle = '#5b3a29'; x.fillRect(w * 0.7, h * 0.35, 10, 70); x.fillStyle = '#4e8c3a'; x.beginPath(); x.arc(w * 0.7 + 5, h * 0.33, 42, 0, TAU); x.fill();
    }
    for (let i = 0; i < 1200; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.06})`; x.fillRect(r() * w, r() * h, 2, 2); }
  });
}

// ---------------------------------------------------------------- materials (shared)
const MATS = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o); if (MATS.has(k)) return MATS.get(k);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...o }); MATS.set(k, m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// light shaft: a soft additive volume from the window opening along the sun direction
const SHAFT = {
  uniforms: { uColor: { value: new THREE.Color('#ffe2a8') }, uI: { value: 0.32 }, uT: { value: 0 } },
  vertexShader: `attribute float aA; attribute float aU; varying float vA; varying float vU; varying vec3 vW;
    void main(){ vA = aA; vU = aU; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uI, uT; varying float vA; varying float vU; varying vec3 vW;
    void main(){ float e = sin(3.14159 * clamp(vU,0.,1.)); float flick = .9 + .1 * sin(uT * .7 + vW.x * 2. + vW.y);
      gl_FragColor = vec4(uColor * uI * vA * e * e * flick, 1.); }`,
};
function shaftMesh(corners, dir, len) {
  // corners: 4 window-rect points (world) in order; builds 4 side faces + a centre fin, each fading along its length
  const pos = [], aA = [], aU = [], idx = [];
  const quad = (p0, p1) => {
    const b = pos.length / 3, q0 = p0.clone().addScaledVector(dir, len), q1 = p1.clone().addScaledVector(dir, len);
    for (const [p, a, u] of [[p0, 1, 0], [p1, 1, 1], [q1, 0, 1], [q0, 0, 0]]) { pos.push(p.x, p.y, p.z); aA.push(a); aU.push(u); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (let i = 0; i < 4; i++) quad(corners[i], corners[(i + 1) % 4]);
  const mid = (a, b) => a.clone().lerp(b, 0.5);
  quad(mid(corners[0], corners[3]), mid(corners[1], corners[2])); quad(mid(corners[0], corners[1]), mid(corners[3], corners[2]));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aA', new THREE.Float32BufferAttribute(aA, 1)); g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ ...SHAFT, uniforms: THREE.UniformsUtils.clone(SHAFT.uniforms), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5; mesh.userData.noPick = true; return mesh;
}
function dustTex() { return canvasTex('dust', 32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }, { aniso: 1 }); }

// ---------------------------------------------------------------- room shell
// def: { W, D, H, floor:{kind,color}, wall:{kind,bg,fg,ac}, wain:color, trim:color, windows:[{wall:'back'|'left'|'right', at, w, h, y}], outdoor }
export function buildShell(def, sunDir) {
  const g = new THREE.Group(), W = def.W, D = def.D, H = def.H, T = 0.16;
  const solids = [];               // meshes used for placement rays and tap hits
  const add = (m, solid = true, cast = true) => { m.castShadow = cast; m.receiveShadow = true; g.add(m); if (solid) solids.push(m); return m; };
  // floor slab
  const ft = def.floor.kind === 'tile' ? tileFloor(def.floor.a, def.floor.b) : def.floor.kind === 'stone' ? stoneFloor() : woodFloor(def.floor.color, def.floor.key || 'w');
  const ftc = ft.clone(); ftc.needsUpdate = true; ftc.repeat.set(W / (def.floor.kind === 'tile' ? 1.4 : 2.6), D / (def.floor.kind === 'tile' ? 1.4 : 2.6));
  const edge = mat(def.trim || '#7a4e2d', { roughness: 0.55 });
  const top = new THREE.MeshStandardMaterial({ map: ftc, roughness: def.floor.kind === 'tile' ? 0.35 : 0.5, metalness: 0 });
  const slab = add(new THREE.Mesh(box(W + T * 2, 0.3, D + T), [edge, edge, top, edge, edge, edge]), true, false); slab.position.set(0, -0.15, -T / 2);
  slab.userData.floor = true;
  if (def.outdoor) {
    // lawn skirt around the patio + low hedge walls (open air)
    const gt = grassTex().clone(); gt.needsUpdate = true; gt.repeat.set(10, 8);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, -0.31, -4); lawn.receiveShadow = true; g.add(lawn);
    // back: brick garden wall with a cap and an arched gate opening, ivy blobs
    const bt = wallpaper('brick', '#d9c8b4', '#b4553f', '#000'); const btc = bt.clone(); btc.needsUpdate = true; btc.repeat.set(1 / 1.4, 1 / 1.4);
    const sh = new THREE.Shape(); sh.moveTo(-W / 2 - T, 0); sh.lineTo(W / 2 + T, 0); sh.lineTo(W / 2 + T, 2.2); sh.lineTo(-W / 2 - T, 2.2); sh.closePath();
    const wallG = new THREE.ExtrudeGeometry(sh, { depth: T * 1.6, bevelEnabled: false });
    const bw = add(new THREE.Mesh(wallG, new THREE.MeshStandardMaterial({ map: btc, roughness: 0.85 }))); bw.position.set(0, 0, -D / 2 - T * 1.6);
    const cap = add(new THREE.Mesh(box(W + T * 2 + 0.1, 0.12, T * 1.6 + 0.12), mat('#e8dcc6'))); cap.position.set(0, 2.26, -D / 2 - T * 0.8);
    const ivyM = mat('#4f8f3a', { roughness: 0.8 }), ivyG = new THREE.IcosahedronGeometry(0.22, 1);
    const ivy = new THREE.InstancedMesh(ivyG, ivyM, 60); const r = srand(31), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < 60; i++) { const side = i < 30 ? -1 : 1, t = r(); const p = new THREE.Vector3(side * (W / 2 - 0.2 - r() * 1.2 * (1 - t)), 2.3 - t * 2.0 * r(), -D / 2 + 0.05 + r() * 0.1);
      const s = 0.6 + r() * 0.8; m4.compose(p, q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(s, s * 0.8, s * 0.5)); ivy.setMatrixAt(i, m4); }
    ivy.castShadow = true; ivy.receiveShadow = true; g.add(ivy);
    // picket fences on the sides
    const pk = mat('#fbf6ee', { roughness: 0.5 }), pg = box(0.08, 0.9, 0.04), n = Math.floor(D / 0.22);
    const fence = new THREE.InstancedMesh(pg, pk, n * 2 + 4);
    let k = 0; for (const sx of [-1, 1]) { for (let i = 0; i < n; i++) { m4.makeTranslation(sx * (W / 2 + 0.02), 0.45, -D / 2 + 0.2 + i * 0.22); fence.setMatrixAt(k++, m4); } }
    fence.count = k; fence.castShadow = true; fence.receiveShadow = true; g.add(fence);
    for (const sx of [-1, 1]) for (const y of [0.25, 0.7]) { const rail = add(new THREE.Mesh(box(0.04, 0.07, D - 0.2), pk), false); rail.position.set(sx * (W / 2 - 0.02), y, 0); }
    // hedges behind
    const hedge = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 2), mat('#5d9b45', { roughness: 0.85 }), 16);
    for (let i = 0; i < 16; i++) { const s = 0.8 + r() * 0.5; m4.compose(new THREE.Vector3(-W / 2 - 1.2 + i * (W + 2.4) / 15, 1.5 + r() * 0.8, -D / 2 - 1.2), q.identity(), new THREE.Vector3(s, s, s * 0.8)); hedge.setMatrixAt(i, m4); }
    hedge.receiveShadow = true; g.add(hedge);
    return { group: g, solids, shafts: [], dust: null, windows: [] };
  }
  const wp = wallpaper(def.wall.kind, def.wall.bg, def.wall.fg, def.wall.ac);
  const wpc = wp.clone(); wpc.needsUpdate = true; const tile = def.wall.kind === 'planks' ? 1.6 : 0.85; wpc.repeat.set(1 / tile, 1 / tile);
  const wpm = new THREE.MeshStandardMaterial({ map: wpc, roughness: 0.82 });
  const wH = def.wain ? 0.95 : 0;
  const wt = def.wain ? wainscotTex(def.wain) : null; let wtm = null;
  if (wt) { const c = wt.clone(); c.needsUpdate = true; c.repeat.set(1 / 0.9, 1 / wH); wtm = new THREE.MeshStandardMaterial({ map: c, roughness: 0.55 }); }
  const trimM = mat(def.trimLight || '#fbf3e4', { roughness: 0.45 }), capM = mat(def.trim || '#7a4e2d', { roughness: 0.5 });
  const shafts = [], wins = [];
  // a wall = local XY plane facing +Z (into the room), placed by a transform
  function wall(len, place, holes) {
    const wg = new THREE.Group(); place(wg); g.add(wg);
    const upper = new THREE.Shape(); upper.moveTo(-len / 2, wH); upper.lineTo(len / 2, wH); upper.lineTo(len / 2, H); upper.lineTo(-len / 2, H); upper.closePath();
    for (const h of holes) { const p = new THREE.Path(); p.moveTo(h.at - h.w / 2, h.y); p.lineTo(h.at - h.w / 2, h.y + h.h); if (h.arch) p.absarc(h.at, h.y + h.h, h.w / 2, Math.PI, 0, true); else p.lineTo(h.at + h.w / 2, h.y + h.h); p.lineTo(h.at + h.w / 2, h.y); p.closePath(); upper.holes.push(p); }
    const ug = new THREE.ExtrudeGeometry(upper, { depth: T, bevelEnabled: false, curveSegments: 16 }); ug.translate(0, 0, -T);
    const um = new THREE.Mesh(ug, wpm); um.castShadow = true; um.receiveShadow = true; wg.add(um); solids.push(um);
    if (wH) {
      const lg = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-len / 2, 0), new THREE.Vector2(len / 2, 0), new THREE.Vector2(len / 2, wH), new THREE.Vector2(-len / 2, wH)]), { depth: T, bevelEnabled: false }); lg.translate(0, 0, -T);
      const lm = new THREE.Mesh(lg, wtm); lm.castShadow = true; lm.receiveShadow = true; wg.add(lm); solids.push(lm);
      const rail = new THREE.Mesh(box(len, 0.06, 0.05), trimM); rail.position.set(0, wH, 0.02); rail.castShadow = true; rail.receiveShadow = true; wg.add(rail);
    }
    const base = new THREE.Mesh(box(len, 0.14, 0.04), trimM); base.position.set(0, 0.07, 0.015); base.receiveShadow = true; wg.add(base);
    if (H > 3.4) { const pr = new THREE.Mesh(box(len, 0.07, 0.05), trimM); pr.position.set(0, 3.1, 0.02); pr.receiveShadow = true; wg.add(pr); }
    const crown = new THREE.Mesh(box(len, 0.16, 0.1), trimM); crown.position.set(0, H - 0.05, 0.03); crown.receiveShadow = true; wg.add(crown);
    const capm = new THREE.Mesh(box(len + 0.02, 0.06, T + 0.04), capM); capm.position.set(0, H + 0.03, -T / 2); capm.castShadow = true; wg.add(capm);
    for (const h of holes) {
      const fr = new THREE.Group(); fr.position.set(h.at, h.y, 0); wg.add(fr);
      const fw = 0.08, fd = T + 0.06;
      const pieces = [[h.w + fw * 2, fw, 0, -fw / 2], [fw, h.h, -h.w / 2 - fw / 2, h.h / 2], [fw, h.h, h.w / 2 + fw / 2, h.h / 2]];
      if (!h.arch) pieces.push([h.w + fw * 2, fw, 0, h.h + fw / 2]);
      for (const [a, b, px, py] of pieces) { const m = new THREE.Mesh(box(a, b, fd), trimM); m.position.set(px, py, -T / 2); m.castShadow = true; m.receiveShadow = true; fr.add(m); }
      if (h.arch) { const ag = new THREE.TorusGeometry(h.w / 2 + fw / 2, fw / 2, 6, 24, Math.PI); const am = new THREE.Mesh(ag, trimM); am.scale.z = fd / fw; am.position.set(0, h.h, -T / 2); fr.add(am); }
      const mul1 = new THREE.Mesh(box(0.035, h.h + (h.arch ? h.w / 2 : 0), 0.04), trimM); mul1.position.set(0, (h.h + (h.arch ? h.w / 2 : 0)) / 2, -T / 2); fr.add(mul1);
      const mul2 = new THREE.Mesh(box(h.w, 0.035, 0.04), trimM); mul2.position.set(0, h.h * 0.55, -T / 2); fr.add(mul2);
      const sill = new THREE.Mesh(box(h.w + 0.3, 0.06, 0.24), trimM); sill.position.set(0, -0.03, 0.06); sill.castShadow = true; sill.receiveShadow = true; fr.add(sill); solids.push(sill);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(h.w, h.h + (h.arch ? h.w / 2 : 0)), new THREE.MeshPhysicalMaterial({ color: '#fff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.4 }));
      glass.position.set(0, (h.h + (h.arch ? h.w / 2 : 0)) / 2, -T / 2); glass.userData.noPick = true; fr.add(glass);
      const vh = h.h + (h.arch ? h.w / 2 : 0);
      const view = new THREE.Mesh(new THREE.PlaneGeometry(h.w + 0.5, vh + 0.4), new THREE.MeshBasicMaterial({ map: outsideTex(), toneMapped: false, color: '#f4efe6' }));
      view.position.set(0, vh / 2, -T - 0.22); view.userData.noPick = true; fr.add(view);
      // curtains + rod
      const ct = fabricTex(def.curtain || '#e9a3b4');
      const cm = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9, side: THREE.DoubleSide });
      const cg = new THREE.PlaneGeometry(0.42, h.h + 0.55, 12, 1); const pa = cg.attributes.position;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 30) * 0.035);
      cg.computeVertexNormals();
      for (const s of [-1, 1]) { const c = new THREE.Mesh(cg, cm); c.position.set(s * (h.w / 2 + 0.2), h.h / 2 + 0.2 + (h.arch ? h.w / 4 : 0), 0.08); c.castShadow = true; c.receiveShadow = true; fr.add(c); }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, h.w + 1.0, 8), mat('#b8893a', { metalness: 0.7, roughness: 0.3 })); rod.rotation.z = Math.PI / 2; rod.position.set(0, h.h + 0.5 + (h.arch ? h.w / 2 : 0), 0.1); fr.add(rod);
      const val = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h.w + 0.9, 14, 1, true, -Math.PI / 2, Math.PI), cm); val.rotation.z = Math.PI / 2; val.position.set(0, h.h + 0.42 + (h.arch ? h.w / 2 : 0), 0.1); fr.add(val);
      wins.push({ fr, h, wg });
    }
    return wg;
  }
  const holes = w => (def.windows || []).filter(x => x.wall === w);
  const walls = {
    back: wall(W + 2 * T, o => o.position.set(0, 0, -D / 2), holes('back')),
    left: wall(D, o => { o.position.set(-W / 2, 0, 0); o.rotation.y = Math.PI / 2; }, holes('left')),
    right: wall(D, o => { o.position.set(W / 2, 0, 0); o.rotation.y = -Math.PI / 2; }, holes('right')),
  };
  for (const [k, wg] of Object.entries(walls)) { wg.userData.wallSide = k; wg.traverse(o => { o.userData.inWall = k; }); }
  // invisible ceiling: blocks the sun so light only enters through the windows
  const ceil = new THREE.Mesh(box(W + 1, 0.1, D + 1), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  ceil.position.set(0, H + 0.1, 0); ceil.castShadow = true; ceil.userData.noPick = true; g.add(ceil);
  // light shafts through each window
  g.updateMatrixWorld(true);
  const motes = [];
  for (const w of wins) {
    const { fr, h } = w; const hh = h.h + (h.arch ? h.w * 0.35 : 0);
    const cs = [[-h.w / 2, hh], [h.w / 2, hh], [h.w / 2, 0], [-h.w / 2, 0]].map(([a, b]) => fr.localToWorld(new THREE.Vector3(a, b, -0.05)));
    const len = (cs[0].y + 0.4) / Math.max(0.2, -sunDir.y);
    const s = shaftMesh(cs, sunDir, len); g.add(s); shafts.push(s);
    const c = cs[0].clone().add(cs[2]).multiplyScalar(0.5);
    for (let i = 0; i < 70; i++) { const t = Math.random() * len * 0.9, p = c.clone().addScaledVector(sunDir, t); p.x += (Math.random() - 0.5) * h.w; p.y += (Math.random() - 0.5) * hh * 0.8; if (p.y > 0.1) motes.push(p.x, p.y, p.z); }
  }
  let dust = null;
  if (motes.length) {
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(motes, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: dustTex(), size: 0.035, color: '#fff2c4', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    dust.userData.base = motes.slice(); dust.userData.noPick = true; g.add(dust);
  }
  return { group: g, solids, shafts, dust, windows: wins, walls };
}

// ---------------------------------------------------------------- code-built decor (extra places to hide things)
export function wallShelf(w = 1.2, color = '#8a5a34') {
  const g = new THREE.Group(), m = mat(color, { roughness: 0.5 });
  const p = new THREE.Mesh(box(w, 0.045, 0.26), m); p.castShadow = p.receiveShadow = true; g.add(p);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(box(0.04, 0.18, 0.2), m); b.position.set(s * (w / 2 - 0.12), -0.1, -0.02); b.castShadow = true; g.add(b); }
  p.position.z = 0.13; g.children.forEach(c => { if (c !== p) c.position.z = 0.1; });
  return g;
}
export function sideTable(r = 0.32, h = 0.62, color = '#9a6236', cloth = null) {
  const g = new THREE.Group(), m = mat(color, { roughness: 0.4 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.045, 28), m); top.position.y = h; g.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 10), m); leg.position.y = h / 2; g.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.04, 20), m); foot.position.y = 0.02; g.add(foot);
  if (cloth) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.1, 0.22, 28, 1, true), mat(cloth, { roughness: 0.9, side: THREE.DoubleSide })); c.position.y = h - 0.09; g.add(c);
    const d = new THREE.Mesh(new THREE.CircleGeometry(r + 0.03, 28), mat(cloth, { roughness: 0.9 })); d.rotation.x = -Math.PI / 2; d.position.y = h + 0.026; g.add(d); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  return g;
}
export function bookStack(n = 4, seed = 1) {
  const r = srand(seed), geos = []; let y = 0; const cols = ['#b5394a', '#2f6f8f', '#e0b64a', '#5b8c4e', '#7b4a8f', '#d9774b', '#3d4f7a', '#efe2c6'];
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const h = 0.035 + r() * 0.03, w = 0.2 + r() * 0.08, d = 0.14 + r() * 0.05; const b = new THREE.Mesh(box(w, h, d), mat(cols[(r() * cols.length) | 0], { roughness: 0.7 }));
    b.position.set((r() - 0.5) * 0.03, y + h / 2, 0); b.rotation.y = (r() - 0.5) * 0.35; y += h; b.castShadow = b.receiveShadow = true; g.add(b); }
  return g;
}
export function rowBooks(w = 0.9, seed = 2) {        // upright books on a shelf, one instanced mesh
  const r = srand(seed), cols = ['#b5394a', '#2f6f8f', '#e0b64a', '#5b8c4e', '#7b4a8f', '#d9774b', '#3d4f7a', '#efe2c6', '#a0522d'];
  const n = Math.floor(w / 0.045), im = new THREE.InstancedMesh(box(1, 1, 1), mat('#ffffff', { roughness: 0.7 }), n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  let x = -w / 2, k = 0; while (x < w / 2 - 0.04 && k < n) { const t = 0.03 + r() * 0.03, h = 0.2 + r() * 0.1, tilt = r() < 0.1 ? 0.25 : 0;
    m4.compose(new THREE.Vector3(x + t / 2, h / 2, 0), q.setFromEuler(new THREE.Euler(0, 0, tilt)), new THREE.Vector3(t, h, 0.16 + r() * 0.04)); im.setMatrixAt(k, m4); im.setColorAt(k, new THREE.Color(cols[(r() * cols.length) | 0])); x += t + 0.004; k++; }
  im.count = k; im.castShadow = im.receiveShadow = true; return im;
}
export function frame(w, h, kind = 0, color = '#c79a3c') {
  const g = new THREE.Group(), m = mat(color, { metalness: 0.6, roughness: 0.35 });
  const b = 0.06; for (const [a, c, x, y] of [[w + b * 2, b, 0, h / 2 + b / 2], [w + b * 2, b, 0, -h / 2 - b / 2], [b, h, -w / 2 - b / 2, 0], [b, h, w / 2 + b / 2, 0]]) { const p = new THREE.Mesh(box(a, c, 0.05), m); p.position.set(x, y, 0.025); p.castShadow = true; g.add(p); }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: paintingTex(kind), roughness: 0.6 })); pic.position.z = 0.012; g.add(pic);
  return g;
}
export function rug(w, d, cols, key) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, d), [mat(cols[1]), mat(cols[1]), new THREE.MeshStandardMaterial({ map: rugTex(cols[0], cols[1], cols[2], key), roughness: 0.95 }), mat(cols[1]), mat(cols[1]), mat(cols[1])]);
  m.position.y = 0.009; m.receiveShadow = true; return m;
}
export function candle(h = 0.16) {
  const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 10), mat('#fff6e8', { roughness: 0.6 })); c.position.y = h / 2; g.add(c);
  const hold = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 14), mat('#c79a3c', { metalness: 0.7, roughness: 0.3 })); hold.position.y = 0.01; g.add(hold);
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf6a' })); f.scale.y = 1.8; f.position.y = h + 0.02; g.add(f);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
export function vase(color = '#6fa8c9', h = 0.3) {
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.06 + Math.sin(t * Math.PI) * 0.07 - (t > 0.8 ? (t - 0.8) * 0.2 : 0), t * h)); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat(color, { roughness: 0.25, metalness: 0.05 })); m.castShadow = m.receiveShadow = true; return m;
}
export function cushion(color, s = 0.36) {
  const g = new THREE.SphereGeometry(0.5, 18, 12); g.scale(s, s * 0.85, s * 0.35);
  const m = new THREE.Mesh(g, mat(color, { roughness: 0.9 })); m.castShadow = m.receiveShadow = true; return m;
}
export function basket(r = 0.2) {
  const pts = []; for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector2(r * (0.75 + i * 0.04), i * r * 0.12));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mat('#c49a5a', { roughness: 0.9, side: THREE.DoubleSide })); m.castShadow = m.receiveShadow = true; return m;
}
export function sconce() {
  const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.05, 12), mat('#c79a3c', { metalness: 0.7, roughness: 0.3 })); b.rotation.x = Math.PI / 2; g.add(b);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), b.material); arm.rotation.x = Math.PI / 2; arm.position.set(0, 0.02, 0.1); g.add(arm);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#fff1d6', emissive: '#ffcf8a', emissiveIntensity: 0.9, side: THREE.DoubleSide })); sh.position.set(0, 0.1, 0.19); g.add(sh);
  return g;
}
export { srand };

// ---------------------------------------------------------------- more code-built furniture (surfaces, nooks and undersides to hide things)
const _t = (o) => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
export function cabinet(w = 1.0, h = 0.85, d = 0.42, color = '#f3e6d0', wood = '#8a5530') {
  const g = new THREE.Group(), body = mat(color, { roughness: 0.5 }), top = mat(wood, { roughness: 0.35 }), knob = mat('#c79a3c', { metalness: 0.7, roughness: 0.3 });
  const b = new THREE.Mesh(box(w, h - 0.12, d), body); b.position.y = 0.06 + (h - 0.12) / 2; g.add(b);
  const t = new THREE.Mesh(box(w + 0.06, 0.05, d + 0.05), top); t.position.y = h - 0.025; g.add(t);
  const n = Math.max(2, Math.round(w / 0.45)), dw = (w - 0.08) / n;
  for (let i = 0; i < n; i++) for (const yy of [0.3, 0.58]) { const f = new THREE.Mesh(box(dw - 0.04, 0.22, 0.02), mat(shade(color, 1.04), { roughness: 0.45 })); f.position.set(-w / 2 + 0.04 + dw * (i + 0.5), yy * h / 0.85, d / 2 + 0.01); g.add(f);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), knob); k.position.set(f.position.x, f.position.y, d / 2 + 0.03); g.add(k); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.08, 8), top); l.position.set(sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.05)); g.add(l); }
  return _t(g);
}
export function consoleTable(w = 1.1, d = 0.4, h = 0.78, color = '#8a5530') {
  const g = new THREE.Group(), m = mat(color, { roughness: 0.4 });
  const t = new THREE.Mesh(box(w, 0.045, d), m); t.position.y = h; g.add(t);
  const s = new THREE.Mesh(box(w - 0.1, 0.03, d - 0.06), m); s.position.y = 0.22; g.add(s);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(box(0.045, h, 0.045), m); l.position.set(sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)); g.add(l); }
  return _t(g);
}
export function ottoman(r = 0.3, h = 0.4, color = '#c9667e') {
  const g = new THREE.Group(), m = mat(color, { roughness: 0.85 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, h - 0.08, 24), m); b.position.y = 0.04 + (h - 0.08) / 2; g.add(b);
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, TAU, 0, Math.PI / 2), m); top.scale.y = 0.22; top.position.y = h - 0.04; g.add(top);
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.06, 8), mat('#6d4127')); l.position.set(Math.cos(i * 1.57 + 0.78) * r * 0.75, 0.03, Math.sin(i * 1.57 + 0.78) * r * 0.75); g.add(l); }
  return _t(g);
}
export function pottedPlant(h = 0.8, pot = '#d9774b', leaf = '#5d9b45', seed = 3) {
  const g = new THREE.Group(), r = srand(seed);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.3, 16), mat(pot, { roughness: 0.6 })); p.position.y = 0.15; g.add(p);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), mat('#5a3a24')); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.29; g.add(soil);
  const lm = mat(leaf, { roughness: 0.7 }), lg = new THREE.IcosahedronGeometry(0.16, 1);
  for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(lg, lm); const a = r() * TAU, d = r() * 0.14; l.position.set(Math.cos(a) * d, 0.35 + r() * (h - 0.4), Math.sin(a) * d); l.scale.set(1 + r() * 0.5, 0.8 + r() * 0.4, 1 + r() * 0.5); g.add(l); }
  return _t(g);
}
export function crate(s = 0.5, color = '#b98a5a') {
  const g = new THREE.Group(), m = mat(color, { roughness: 0.8 }), dk = mat(shade(color, 0.75), { roughness: 0.8 });
  const b = new THREE.Mesh(box(s, s * 0.8, s), m); b.position.y = s * 0.4; g.add(b);
  for (const y of [0.08, 0.72]) for (const z of [-1, 1]) { const p = new THREE.Mesh(box(s + 0.02, 0.05, 0.02), dk); p.position.set(0, y * s, z * (s / 2 + 0.005)); g.add(p); }
  return _t(g);
}
export function stool(h = 0.45, color = '#9a6236') {
  const g = new THREE.Group(), m = mat(color, { roughness: 0.45 });
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 20), m); t.position.y = h; g.add(t);
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, h, 8), m); const a = i * TAU / 3; l.position.set(Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12); l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); g.add(l); }
  return _t(g);
}
export function hatbox(r = 0.18, h = 0.2, color = '#9fd0c4') {
  const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat(color, { roughness: 0.7 })); b.position.y = h / 2; g.add(b);
  const l = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.05, 20), mat(shade(color, 0.85), { roughness: 0.7 })); l.position.y = h; g.add(l);
  const rb = new THREE.Mesh(new THREE.TorusGeometry(r + 0.013, 0.008, 6, 24), mat('#e77c93')); rb.rotation.x = Math.PI / 2; rb.position.y = h * 0.45; g.add(rb);
  return _t(g);
}
export function umbrellaStand() {
  const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.5, 16, 1, true), mat('#3d6b8a', { roughness: 0.3, side: THREE.DoubleSide })); c.position.y = 0.25; g.add(c);
  for (const [a, col] of [[0.3, '#e77c93'], [-0.2, '#f2c46b']]) { const u = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.04, 0.8, 8), mat(col)); u.position.set(Math.sin(a) * 0.06, 0.5, Math.cos(a) * 0.04); u.rotation.z = a * 0.3; g.add(u);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 12, Math.PI), mat('#5a3a24')); h.position.set(u.position.x + 0.04, 0.9, u.position.z); g.add(h); }
  return _t(g);
}

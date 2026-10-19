// Ironsquall world: a sunny, saturated, stylised megacity built entirely in code.
// Streets every 60 m (x,z = 0..300), 28 m building lots, a central plaza at (150,150), a hazy skyline ring.
import * as THREE from './kit/three.module.min.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { GB, mechMat, toonGrad, addOutline } from './models.js';

export const CELL = 60, MAP0 = -10, MAP1 = 310;
const rnd = (s) => { s = s % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const POP = ['#ff4d6d', '#ffb703', '#2ec4b6', '#3a86ff', '#8338ec', '#ff7b00', '#06d6a0', '#ef476f', '#118ab2', '#ffd23f'];
const WALL = ['#ff8a65', '#ffd166', '#7bdcb5', '#8ecae6', '#f4a3c0', '#f1e6cf', '#b8a6ee', '#ff7a5c', '#a7e07a', '#ffc6a5', '#9ad9f0', '#f7f0e0'];
const BRANDS = ['KAZE COLA', 'OKAMI', 'ZEN-TEK', 'VOLTA', 'HALO BAR', 'KOBOLT', 'NEXA', 'MOTEL 9', 'RAMEN 24', 'SYNAPSE', 'LUMEN', 'PRISMA', 'HEXA', 'ORBIT', 'DRIFT', 'PULSE', 'NOODLE', 'ARCADE', 'HOTEL', 'KOI CLUB', 'TAKO', 'NOVA', 'GRIDDY', 'SHIRO', 'BYTE', 'RONIN', 'AKARI', 'DYNA', 'YUME', 'OPEN 24H', 'CAFE', 'MIRA'];
const KANA = ['ラーメン', 'カフェ', 'ホテル', 'スシ', 'ゲーム', 'デンキ', 'ユメ', 'ソラ', 'ハナ', 'カゼ', 'パン', 'ピザ', 'タコ', 'ネコ', 'ロボ', 'ミセ'];
const TAGS = ['ZAP!', 'KRAK', 'BOOM', 'YO!', 'RIOT', 'SQ7', 'HEX', 'POW', 'WOW', 'GO!'];

// ------------------------------------------------------------------ canvas textures (alpha = "tint mask": 1 takes the building colour, ~.55 keeps its own)
function noiseFill(x, w, h, a = 0.05, k = 3) { for (let i = 0; i < w * k; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * a})`; const s = 1 + Math.random() * 3; x.fillRect(Math.random() * w, Math.random() * h, s, s); } }
const MASK = 'rgba(255,255,255,1)';
function keepA(x, fn) { x.save(); x.globalCompositeOperation = 'source-over'; fn(); x.restore(); }
function bubble(x, t, cx, cy, size, fill, rot = -0.08) {   // graffiti tag: fat outlined bubble letters
  x.save(); x.translate(cx, cy); x.rotate(rot); x.font = `900 ${size}px "Arial Black","Impact",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineJoin = 'round'; x.lineWidth = size * 0.28; x.strokeStyle = '#1b1626'; x.strokeText(t, 0, 0); x.lineWidth = size * 0.14; x.strokeStyle = '#ffffff'; x.strokeText(t, 0, 0);
  const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, fill); g.addColorStop(1, POP[(Math.random() * POP.length) | 0]); x.fillStyle = g; x.fillText(t, 0, 0);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(-size, -size * 0.28, size * 0.2, size * 0.08); x.restore();
}
function windowPane(x, wx, wy, ww, wh, R, frame = '#ffffff') {
  x.fillStyle = frame; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh); g.addColorStop(0, '#bfe6ff'); g.addColorStop(0.5, '#5fa8e0'); g.addColorStop(1, '#2d6aa8'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(wx + ww * 0.15, wy + wh); x.lineTo(wx + ww * 0.45, wy); x.lineTo(wx + ww * 0.6, wy); x.lineTo(wx + ww * 0.3, wy + wh); x.fill();
  if (R() < 0.3) { x.fillStyle = POP[(R() * POP.length) | 0]; x.fillRect(wx, wy, ww * 0.3, wh); x.fillRect(wx + ww * 0.7, wy, ww * 0.3, wh); }   // curtains
  if (R() < 0.12) { x.fillStyle = '#ffe9a8'; x.fillRect(wx, wy, ww, wh); }                                                                       // sun glint
  x.fillStyle = frame; x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
}
function facadeTex(style, R) {
  const n = 512, a = cv(n, n), x = a.getContext('2d');
  x.clearRect(0, 0, n, n); x.fillStyle = MASK; x.fillRect(0, 0, n, n);
  // wall texture in near-white (mask = 1 so the building colour tints it)
  noiseFill(x, n, n, 0.07, 4);
  const own = (fn) => { x.globalAlpha = 1; fn(); };
  x.globalCompositeOperation = 'source-over';
  const unmask = (fn) => { const c2 = cv(n, n), y = c2.getContext('2d'); fn(y); y.globalCompositeOperation = 'destination-in'; y.fillStyle = 'rgba(0,0,0,.55)'; y.fillRect(0, 0, n, n); x.globalCompositeOperation = 'destination-out'; x.drawImage(cutout(c2), 0, 0); x.globalCompositeOperation = 'source-over'; x.drawImage(c2, 0, 0); };
  const cutout = (c2) => { const c3 = cv(n, n), z = c3.getContext('2d'); z.drawImage(c2, 0, 0); z.globalCompositeOperation = 'source-in'; z.fillStyle = '#000'; z.fillRect(0, 0, n, n); const c4 = cv(n, n), q = c4.getContext('2d'); q.drawImage(c3, 0, 0); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; return c4; };
  if (style === 0) {          // apartments: windows with frames, balconies with plants
    for (let f = 0; f < 8; f++) {
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, f * 64 + 58, n, 6);
      unmask(y => { for (let c = 0; c < 4; c++) { const wx = c * 128 + 30, wy = f * 64 + 12; windowPane(y, wx, wy, 68, 40, R);
        if (R() < 0.35) { y.fillStyle = '#ffffff'; y.fillRect(wx - 10, wy + 40, 88, 6); for (let k = 0; k < 9; k++) y.fillRect(wx - 8 + k * 10, wy + 30, 2, 12); for (let k = 0; k < 6; k++) { y.fillStyle = ['#3fbf4f', '#2e9e40', '#ff5d8f', '#ffd23f'][(R() * 4) | 0]; y.beginPath(); y.arc(wx - 4 + k * 15, wy + 34, 6, 0, 7); y.fill(); } } } });
    }
  } else if (style === 1) {   // offices: blue glass ribbons with white spandrels
    for (let f = 0; f < 8; f++) unmask(y => { const yy = f * 64 + 10; const g = y.createLinearGradient(0, yy, 0, yy + 44); g.addColorStop(0, '#a8dcff'); g.addColorStop(1, '#2f6fb0'); y.fillStyle = g; y.fillRect(0, yy, n, 44);
      y.fillStyle = '#e8f4ff'; for (let c = 0; c < n; c += 32) y.fillRect(c, yy, 3, 44); y.fillStyle = 'rgba(255,255,255,.45)'; for (let k = 0; k < 4; k++) { const sx = R() * n; y.beginPath(); y.moveTo(sx, yy + 44); y.lineTo(sx + 26, yy); y.lineTo(sx + 40, yy); y.lineTo(sx + 14, yy + 44); y.fill(); } });
  } else {                    // old brick blocks: arched windows, AC units
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2; for (let r = 0; r < n; r += 12) { x.beginPath(); x.moveTo(0, r); x.lineTo(n, r); x.stroke(); for (let c = (r / 12) % 2 ? 0 : 12; c < n; c += 24) { x.beginPath(); x.moveTo(c, r); x.lineTo(c, r + 12); x.stroke(); } }
    for (let f = 0; f < 8; f++) unmask(y => { for (let c = 0; c < 5; c++) { const wx = c * 102 + 26, wy = f * 64 + 14; y.fillStyle = '#ffffff'; y.beginPath(); y.arc(wx + 24, wy + 14, 27, Math.PI, 0); y.lineTo(wx + 51, wy + 46); y.lineTo(wx - 3, wy + 46); y.fill(); windowPane(y, wx, wy + 12, 48, 32, R); y.fillStyle = '#5fa8e0'; y.beginPath(); y.arc(wx + 24, wy + 14, 24, Math.PI, 0); y.fill();
      if (R() < 0.3) { y.fillStyle = '#d8dde4'; y.fillRect(wx + 8, wy + 47, 30, 12); y.fillStyle = '#9aa3ad'; y.fillRect(wx + 12, wy + 50, 22, 3); } } });
  }
  x.fillStyle = 'rgba(70,70,80,1)'; x.fillRect(0, 0, 8, 8);
  const t = new THREE.CanvasTexture(a); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.premultiplyAlpha = false;
  return t;
}
function storefrontTex(R) {
  const w = 1024, h = 176, a = cv(w, h), x = a.getContext('2d');
  x.fillStyle = 'rgba(232,226,214,1)'; x.fillRect(0, 0, w, h); noiseFill(x, w, h, 0.05, 2);
  const c2 = cv(w, h), y = c2.getContext('2d');
  const inter = ['#fff3d6', '#e6f7ff', '#ffe6f2', '#efffe6', '#fff0c8'];
  for (let s = 0; s < 4; s++) {
    const x0 = s * 256 + 10, gw = 236;
    y.fillStyle = '#2b2f38'; y.fillRect(x0, 36, gw, 140);
    if (R() < 0.3) {       // shutter with graffiti
      for (let i = 40; i < 176; i += 7) { y.fillStyle = i % 14 ? '#b8bec8' : '#a2a9b4'; y.fillRect(x0 + 4, i, gw - 8, 5); }
      bubble(y, TAGS[(R() * TAGS.length) | 0], x0 + gw / 2, 108, 56, POP[(R() * POP.length) | 0], (R() - 0.5) * 0.3);
    } else {
      const g = y.createLinearGradient(0, 40, 0, 176); g.addColorStop(0, inter[(R() * inter.length) | 0]); g.addColorStop(1, '#d8c8b0'); y.fillStyle = g; y.fillRect(x0 + 6, 40, gw - 12, 136);
      for (let k = 0; k < 3; k++) { const sy = 80 + k * 30; y.fillStyle = '#8a6a4a'; y.fillRect(x0 + 16, sy, gw - 32, 5); for (let j = 0; j < 10; j++) if (R() < 0.8) { y.fillStyle = POP[(R() * POP.length) | 0]; y.fillRect(x0 + 20 + j * 21, sy - 14, 14, 14); } }
      y.fillStyle = '#3a2a22'; y.fillRect(x0 + gw - 66, 74, 46, 102); y.fillStyle = '#ffd23f'; y.fillRect(x0 + gw - 28, 120, 4, 10);
      y.fillStyle = 'rgba(255,255,255,.35)'; y.beginPath(); y.moveTo(x0 + 20, 176); y.lineTo(x0 + 70, 40); y.lineTo(x0 + 95, 40); y.lineTo(x0 + 45, 176); y.fill();
      y.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) y.fillRect(x0 + 4 + k * 78, 36, 5, 140);
    }
    // painted sign band
    const hc = POP[(R() * POP.length) | 0]; y.fillStyle = hc; y.beginPath(); y.roundRect(x0 + 6, 4, gw - 12, 28, 6); y.fill(); y.strokeStyle = '#1b1626'; y.lineWidth = 3; y.stroke();
    y.fillStyle = '#fff'; y.font = '900 19px "Arial Black","Hiragino Sans",sans-serif'; y.textAlign = 'center'; y.fillText(BRANDS[(R() * BRANDS.length) | 0] + ' · ' + KANA[(R() * KANA.length) | 0], x0 + gw / 2, 25);
  }
  // keep-colour region alpha .55
  const m = cv(w, h), z = m.getContext('2d'); z.drawImage(c2, 0, 0); z.globalCompositeOperation = 'source-in'; z.fillStyle = '#000'; z.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-out'; x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-over';
  y.globalCompositeOperation = 'destination-in'; y.fillStyle = 'rgba(0,0,0,.55)'; y.fillRect(0, 0, w, h); x.drawImage(c2, 0, 0);
  x.fillStyle = 'rgba(70,70,80,1)'; x.fillRect(0, 0, 8, 8);
  const t = new THREE.CanvasTexture(a); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.premultiplyAlpha = false;
  return t;
}
// painted sign + billboard atlas (2048²): 32 horizontal 512×128, 16 vertical 128×512, 4 posters 512×512
function signAtlas(R) {
  const N = 2048, c = cv(N, N), x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, N, N);
  const cells = { h: [], v: [], ad: [] };
  const uvr = (px, py, w, h) => [px / N, 1 - (py + h) / N, (px + w) / N, 1 - py / N];
  const label = (t, cx, cy, size, fill = '#fff') => { x.font = `900 ${size}px "Arial Black","Hiragino Sans","Helvetica Neue",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = size * 0.22; x.strokeStyle = '#1b1626'; x.strokeText(t, cx, cy); x.fillStyle = fill; x.fillText(t, cx, cy); };
  const panel = (px, py, w, h, col, r = 22) => { x.fillStyle = '#1b1626'; x.beginPath(); x.roundRect(px, py, w, h, r); x.fill(); x.fillStyle = col; x.beginPath(); x.roundRect(px + 7, py + 7, w - 14, h - 14, r - 5); x.fill(); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.roundRect(px + 14, py + 12, w - 28, (h - 24) * 0.35, 10); x.fill(); };
  for (let i = 0; i < 32; i++) {
    const px = (i % 4) * 512, py = Math.floor(i / 4) * 128, col = POP[i % POP.length];
    panel(px + 6, py + 6, 500, 116, col); const t = BRANDS[i]; label(t, px + 256, py + 66, t.length > 8 ? 50 : 62, i % 3 ? '#fff' : '#ffe14d');
    cells.h.push({ uv: uvr(px + 2, py + 2, 508, 124), col });
  }
  for (let i = 0; i < 16; i++) {
    const px = (i % 8) * 128, py = 1024 + Math.floor(i / 8) * 512, col = POP[(i * 3 + 1) % POP.length];
    panel(px + 6, py + 6, 116, 500, col, 26); const chars = [...KANA[i]], sz = Math.min(80, 400 / chars.length);
    chars.forEach((ch, j) => label(ch, px + 64, py + 256 + (j - (chars.length - 1) / 2) * sz * 1.08, sz));
    cells.v.push({ uv: uvr(px + 2, py + 2, 124, 508), col });
  }
  const ads = [
    (px, py) => { const g = x.createLinearGradient(0, py, 0, py + 512); g.addColorStop(0, '#ff4d6d'); g.addColorStop(1, '#ff8a3d'); x.fillStyle = g; x.fillRect(px, py, 512, 512);
      x.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(px + 256, py + 256); x.arc(px + 256, py + 256, 400, i * 0.52, i * 0.52 + 0.26); x.fill(); }
      x.save(); x.translate(px + 256, py + 230); x.rotate(0.15); x.fillStyle = '#1b1626'; x.beginPath(); x.roundRect(-78, -150, 156, 300, 34); x.fill(); x.fillStyle = '#e8ecf2'; x.beginPath(); x.roundRect(-70, -142, 140, 284, 28); x.fill(); x.fillStyle = '#ff2d55'; x.fillRect(-70, -70, 140, 150); label('KAZE', 0, 5, 44); x.restore();
      label('KAZE COLA', px + 256, py + 440, 62, '#ffe14d'); },
    (px, py) => { x.fillStyle = '#ffd23f'; x.fillRect(px, py, 512, 512); x.fillStyle = '#ffb703'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(px + 60 + i * 60, py + 470, 40, 0, 7); x.fill(); }
      x.fillStyle = '#1b1626'; x.beginPath(); x.arc(px + 256, py + 230, 160, 0, Math.PI); x.fill(); x.fillStyle = '#ff4d6d'; x.beginPath(); x.arc(px + 256, py + 230, 150, 0, Math.PI); x.fill();
      x.fillStyle = '#fff3c8'; x.beginPath(); x.ellipse(px + 256, py + 232, 150, 30, 0, 0, 7); x.fill(); x.strokeStyle = '#ffb000'; x.lineWidth = 8; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(px + 150 + i * 40, py + 236); x.quadraticCurveTo(px + 170 + i * 40, py + 200, px + 160 + i * 38, py + 120); x.stroke(); }
      x.strokeStyle = '#7a4a2a'; x.lineWidth = 12; x.beginPath(); x.moveTo(px + 330, py + 230); x.lineTo(px + 430, py + 70); x.moveTo(px + 360, py + 232); x.lineTo(px + 460, py + 80); x.stroke();
      label('OKAMI', px + 256, py + 70, 70); label('ラーメン', px + 256, py + 420, 60, '#ff4d6d'); },
    (px, py) => { const g = x.createLinearGradient(px, py, px + 512, py + 512); g.addColorStop(0, '#2ec4b6'); g.addColorStop(1, '#3a86ff'); x.fillStyle = g; x.fillRect(px, py, 512, 512);
      for (let r = 170; r > 20; r -= 30) { x.fillStyle = r % 60 > 20 ? '#ffffff' : '#1b1626'; x.beginPath(); x.arc(px + 256, py + 220, r, 0, 7); x.fill(); }
      x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(px + 256, py + 220, 26, 0, 7); x.fill(); label('HALCYON', px + 256, py + 440, 64); },
    (px, py) => { const g = x.createLinearGradient(0, py, 0, py + 512); g.addColorStop(0, '#8338ec'); g.addColorStop(1, '#ff4d9d'); x.fillStyle = g; x.fillRect(px, py, 512, 512);
      x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(px + 70, py + 300); x.lineTo(px + 150, py + 210); x.lineTo(px + 340, py + 200); x.lineTo(px + 450, py + 270); x.lineTo(px + 440, py + 320); x.lineTo(px + 80, py + 330); x.closePath(); x.fill(); x.lineWidth = 8; x.strokeStyle = '#1b1626'; x.stroke();
      x.fillStyle = '#5fd0ff'; x.beginPath(); x.moveTo(px + 170, py + 220); x.lineTo(px + 330, py + 212); x.lineTo(px + 380, py + 262); x.lineTo(px + 160, py + 262); x.fill();
      x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) x.fillRect(px + 20, py + 350 + i * 16, 180 - i * 30, 7);
      label('VOLTA', px + 256, py + 100, 80); label('FLY HOME', px + 256, py + 440, 52, '#ffe14d'); },
  ];
  ads.forEach((fn, i) => { const px = 1024 + (i % 2) * 512, py = 1024 + Math.floor(i / 2) * 512; x.save(); x.beginPath(); x.rect(px, py, 512, 512); x.clip(); fn(px, py); x.restore(); x.strokeStyle = '#1b1626'; x.lineWidth = 12; x.strokeRect(px + 6, py + 6, 500, 500); cells.ad.push({ uv: uvr(px + 6, py + 6, 500, 500) }); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, cells };
}
function asphaltTex() {
  const n = 512, a = cv(n, n), x = a.getContext('2d'); x.fillStyle = '#80838d'; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 4000; i++) { const v = 100 + Math.random() * 60; x.fillStyle = `rgba(${v},${v},${v + 8},${0.25 + Math.random() * 0.4})`; x.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(70,72,80,${0.15 + Math.random() * 0.15})`; x.beginPath(); x.roundRect(Math.random() * n, Math.random() * n, 30 + Math.random() * 90, 20 + Math.random() * 60, 8); x.fill(); }
  for (let i = 0; i < 12; i++) { x.strokeStyle = 'rgba(50,50,58,.35)'; x.lineWidth = 2; x.beginPath(); let px = Math.random() * n, py = Math.random() * n; x.moveTo(px, py); for (let k = 0; k < 6; k++) x.lineTo(px += (Math.random() - 0.5) * 60, py += (Math.random() - 0.5) * 60); x.stroke(); }
  const t = new THREE.CanvasTexture(a); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function pavingTex() {
  const n = 256, a = cv(n, n), x = a.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, n, n); noiseFill(x, n, n, 0.08, 3);
  x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 3; for (let i = 0; i <= n; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, n); x.moveTo(0, i); x.lineTo(n, i); x.stroke(); }
  const t = new THREE.CanvasTexture(a); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ------------------------------------------------------------------ toon facade material with the alpha tint mask
function tintMaskCompile(sh) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#if defined( USE_COLOR )
      float wm = smoothstep(.7, .95, diffuseColor.a); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vColor, wm); diffuseColor.a = 1.;
    #endif`);
}
function facadeMat(map) { const m = new THREE.MeshToonMaterial({ map, vertexColors: true, gradientMap: toonGrad() }); m.onBeforeCompile = tintMaskCompile; m.customProgramCacheKey = () => 'tintmask'; return m; }
function paint(geo, col) { const c = new THREE.Color(col), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; }

// ------------------------------------------------------------------ build
export function buildCity(scene, { lite = false, keep = [] } = {}) {
  const R = rnd(90210), W = { colliders: [], vents: [], update: null };
  const fac = [facadeTex(0, R), facadeTex(1, R), facadeTex(2, R)], storeT = storefrontTex(R), atlas = signAtlas(R);
  const facMats = fac.map(facadeMat), storeMat = facadeMat(storeT);
  const facGeos = [[], [], []], storeGeos = [];
  const PROPC = 3, props = [], walk = new GB();
  for (let i = 0; i < PROPC * PROPC; i++) props.push(new GB());
  const propAt = (x, z) => props[Math.max(0, Math.min(PROPC - 1, Math.floor((x + 50) / (400 / PROPC)))) * PROPC + Math.max(0, Math.min(PROPC - 1, Math.floor((z + 50) / (400 / PROPC))))];
  const sgPos = [], sgUv = [], sgNrm = [];
  const keepClear = (x, z, r) => keep.some(k => Math.hypot(k[0] - x, k[1] - z) < r + (k[2] || 8));
  const quad = (c, r, u, hw, hh, uv) => {
    const p = (a, b) => [c.x + r.x * a * hw + u.x * b * hh, c.y + r.y * a * hw + u.y * b * hh, c.z + r.z * a * hw + u.z * b * hh];
    const v = [p(-1, -1), p(1, -1), p(1, 1), p(-1, -1), p(1, 1), p(-1, 1)], t = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    const nn = new THREE.Vector3().crossVectors(r, u).normalize();
    for (let k = 0; k < 6; k++) { sgPos.push(...v[k]); sgUv.push(...t[k]); sgNrm.push(nn.x, nn.y, nn.z); }
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const facBox = (list, x0, y0, z0, x1, y1, z1, U, col, Vs) => {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0, g = new THREE.BoxGeometry(w, h, d); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const uv = g.attributes.uv, ou = Math.floor(R() * 4) / 4;
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k; if (f === 2 || f === 3) { uv.setXY(i, 0.004, 0.996); continue; }
      const span = f < 2 ? d : w; uv.setXY(i, ou + uv.getX(i) * span / U, Vs ? uv.getY(i) : uv.getY(i) * h / U);
    }
    list.push(paint(g, col));
  };
  const S = (k) => k * CELL;
  const tree = (pg, x, z, s = 1) => {
    pg.cyl(0.22 * s, 0.32 * s, 3.2 * s, x, 1.6 * s, z, '#7a4f2e', { seg: 7 });
    const g1 = ['#4cc04a', '#3aa845', '#6fd65a'];
    pg.sph(1.9 * s, x, 4.2 * s, z, g1[(R() * 3) | 0], { seg: 10, seg2: 8 }); pg.sph(1.4 * s, x + 1.1 * s, 3.7 * s, z + 0.5 * s, g1[(R() * 3) | 0], { seg: 9, seg2: 7 }); pg.sph(1.3 * s, x - 0.9 * s, 3.9 * s, z - 0.7 * s, g1[(R() * 3) | 0], { seg: 9, seg2: 7 }); pg.sph(1.1 * s, x + 0.2 * s, 5.4 * s, z - 0.2 * s, '#7be06a', { seg: 9, seg2: 7 });
    pg.box(1.6 * s, 0.5, 1.6 * s, x, 0.25, z, '#8a6a4e', { r: 0.1 });
  };

  // ---------------- buildings
  for (let i = -1; i <= 5; i++) for (let j = -1; j <= 5; j++) {
    const lx0 = S(i) + 16, lz0 = S(j) + 16, lx1 = lx0 + 28, lz1 = lz0 + 28, outer = i < 0 || j < 0 || i > 4 || j > 4, plaza = i === 2 && j === 2;
    if (plaza) continue;
    W.colliders.push({ x0: lx0, z0: lz0, x1: lx1, z1: lz1, h: 400, lot: true });
    walk.box(36, 0.3, 36, lx0 + 14, 0.15, lz0 + 14, '#e4dccd', { r: 0, uv: 9 });
    walk.box(36.3, 0.32, 0.4, lx0 + 14, 0.16, lz0 - 1.95, '#c8c0b2', { r: 0 }); walk.box(36.3, 0.32, 0.4, lx0 + 14, 0.16, lz1 + 1.95, '#c8c0b2', { r: 0 });
    walk.box(0.4, 0.32, 36.3, lx0 - 1.95, 0.16, lz0 + 14, '#c8c0b2', { r: 0 }); walk.box(0.4, 0.32, 36.3, lx1 + 1.95, 0.16, lz0 + 14, '#c8c0b2', { r: 0 });
    const bxs = [], sub = R();
    if (sub < 0.3) bxs.push([lx0, lz0, lx1, lz1]);
    else if (sub < 0.65) { if (R() < 0.5) bxs.push([lx0, lz0, lx0 + 13.5, lz1], [lx0 + 14.5, lz0, lx1, lz1]); else bxs.push([lx0, lz0, lx1, lz0 + 13.5], [lx0, lz0 + 14.5, lx1, lz1]); }
    else bxs.push([lx0, lz0, lx0 + 13.5, lz0 + 13.5], [lx0 + 14.5, lz0, lx1, lz0 + 13.5], [lx0, lz0 + 14.5, lx0 + 13.5, lz1], [lx0 + 14.5, lz0 + 14.5, lx1, lz1]);
    for (const [x0, z0, x1, z1] of bxs) {
      const st = R() < 0.4 ? 0 : R() < 0.5 ? 2 : 1, U = 24, col = WALL[(R() * WALL.length) | 0], trim = POP[(R() * POP.length) | 0];
      const h = outer ? 50 + R() * 90 : 18 + R() * 55;
      facBox(storeGeos, x0, 0, z0, x1, 5.6, z1, 32, '#ffffff', true);
      facBox(facGeos[st], x0 + 0.25, 5.6, z0 + 0.25, x1 - 0.25, h, z1 - 0.25, U, col);
      const pgb = propAt((x0 + x1) / 2, (z0 + z1) / 2), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      pgb.box(x1 - x0 + 0.7, 0.6, z1 - z0 + 0.7, cx, 5.9, cz, trim, { r: 0.12 });
      pgb.box(x1 - x0 + 0.9, 1.0, z1 - z0 + 0.9, cx, h + 0.3, cz, '#ffffff', { r: 0.2 });                 // cornice
      if (st === 0) for (let yy = 17.6; yy < h - 4; yy += 12) pgb.box(x1 - x0 + 0.5, 0.35, z1 - z0 + 0.5, cx, yy, cz, '#ffffff', { r: 0.08 });
      if (h > 45 && R() < 0.55) {
        const ins = 2.5 + R() * 2, h2 = h + 10 + R() * 30, col2 = WALL[(R() * WALL.length) | 0];
        facBox(facGeos[st], x0 + ins, h, z0 + ins, x1 - ins, h2, z1 - ins, U, col2);
        pgb.box(x1 - x0 - ins * 2 + 0.9, 0.9, z1 - z0 - ins * 2 + 0.9, cx, h2 + 0.3, cz, '#ffffff', { r: 0.2 });
        if (R() < 0.5) { pgb.cyl(0.15, 0.35, 10, cx, h2 + 5, cz, '#e8e8f0', { seg: 6 }); pgb.sph(0.6, cx, h2 + 10.2, cz, '#ff4d6d', { seg: 8, e: 0.5 }); }
      }
      // roof clutter: water towers, AC, rooftop billboard, garden
      for (let k = 0; k < 2; k++) if (R() < 0.5) { const tx = x0 + 3 + R() * (x1 - x0 - 6), tz = z0 + 3 + R() * (z1 - z0 - 6); pgb.cyl(1.4, 1.4, 3, tx, h + 3.4, tz, '#c98a52', { seg: 12 }); pgb.cyl(1.7, 0.2, 1.2, tx, h + 5.5, tz, '#a0603a', { seg: 12 }); for (const a of [0, 1, 2, 3]) pgb.cyl(0.1, 0.1, 2, tx + Math.cos(a * 1.57) * 1.1, h + 1.6, tz + Math.sin(a * 1.57) * 1.1, '#5a4a40', { seg: 4 }); }
      for (let k = 0; k < 3; k++) pgb.box(2 + R() * 2, 1.3, 2 + R(), x0 + 3 + R() * (x1 - x0 - 6), h + 1.4, z0 + 3 + R() * (z1 - z0 - 6), '#d8dde6', { r: 0.15 });
      if (R() < 0.3) for (let k = 0; k < 3; k++) tree(pgb, x0 + 3 + R() * (x1 - x0 - 6), z0 + 3 + R() * (z1 - z0 - 6), 0.6);
      // street-facing facades
      const faces = [];
      if (x0 === lx0) faces.push({ nx: -1, nz: 0, px: x0, a: z0, b: z1, ax: 'z' }); if (x1 === lx1) faces.push({ nx: 1, nz: 0, px: x1, a: z0, b: z1, ax: 'z' });
      if (z0 === lz0) faces.push({ nx: 0, nz: -1, px: z0, a: x0, b: x1, ax: 'x' }); if (z1 === lz1) faces.push({ nx: 0, nz: 1, px: z1, a: x0, b: x1, ax: 'x' });
      if (R() < 0.3 && faces.length) {   // rooftop billboard facing a street
        const f = faces[0], cell = atlas.cells.ad[(R() * 4) | 0], s = (f.a + f.b) / 2, y = h + 7.5;
        const c = f.ax === 'z' ? V(f.px - f.nx * 4, y, s) : V(s, y, f.px - f.nz * 4), along = V(f.nz, 0, -f.nx);
        quad(c.clone().add(V(f.nx * 0.3, 0, f.nz * 0.3)), along, V(0, 1, 0), 6.5, 6.5, cell.uv);
        if (f.ax === 'z') { pgb.box(0.4, 14, 14, c.x, y, c.z, '#3a3f4a', { r: 0.1 }); for (const q of [-4, 4]) pgb.box(0.4, 8, 0.4, c.x - f.nx * 1.5, h + 2, c.z + q, '#5a606c', { r: 0 }); }
        else { pgb.box(14, 14, 0.4, c.x, y, c.z, '#3a3f4a', { r: 0.1 }); for (const q of [-4, 4]) pgb.box(0.4, 8, 0.4, c.x + q, h + 2, c.z - f.nz * 1.5, '#5a606c', { r: 0 }); }
      }
      for (const f of faces) {
        const at = (s, y, out = 0) => f.ax === 'z' ? V(f.px + f.nx * out, y, s) : V(s, y, f.px + f.nz * out);
        const along = V(f.nz, 0, -f.nx);
        const nrm = V(f.nx, 0, f.nz), len = f.b - f.a;
        if (R() < 0.85) { const cell = atlas.cells.h[(R() * 32) | 0], s = f.a + 2 + R() * (len - 12), c = at(s + 4.5, 7.3, 0.45); propAt(c.x, c.z).box(f.ax === 'z' ? 0.5 : 9.8, 2.7, f.ax === 'z' ? 9.8 : 0.5, c.x - nrm.x * 0.2, 7.3, c.z - nrm.z * 0.2, '#2a2f3a', { r: 0.08 }); quad(c, along, V(0, 1, 0), 4.6, 1.15, cell.uv); }
        const nb = ((R() * 2.2) | 0);
        for (let k = 0; k < nb; k++) {
          const cell = atlas.cells.v[(R() * 16) | 0], s = f.a + 2 + R() * (len - 4), y = 11 + R() * Math.min(10, h - 18), c = at(s, y, 1.9), pgx = propAt(c.x, c.z);
          if (y + 5 > h) continue;
          if (f.ax === 'z') pgx.box(3.2, 10.6, 0.35, c.x, y, c.z, '#2a2f3a', { r: 0.08 }); else pgx.box(0.35, 10.6, 3.2, c.x, y, c.z, '#2a2f3a', { r: 0.08 });
          for (const sd of [1, -1]) { const side = f.ax === 'z' ? V(0, 0, sd * 0.19) : V(sd * 0.19, 0, 0); const right = f.ax === 'z' ? V(sd, 0, 0) : V(0, 0, -sd); quad(c.clone().add(side), right, V(0, 1, 0), 1.45, 5.2, cell.uv); }
          for (const yy of [y - 4, y + 4]) { const b0 = at(s, yy, 0.9); pgx.box(f.ax === 'z' ? 1.8 : 0.14, 0.14, f.ax === 'z' ? 0.14 : 1.8, b0.x, yy, b0.z, '#5a606c', { r: 0 }); }
        }
        for (let k = 0; k < 4; k++) { const c = at(f.a + 1.5 + R() * (len - 3), 9 + Math.floor(R() * Math.min(5, (h - 12) / 4)) * 4, 0.2), pgx = propAt(c.x, c.z); pgx.box(f.ax === 'z' ? 0.9 : 1.4, 0.9, f.ax === 'z' ? 1.4 : 0.9, c.x, c.y, c.z, '#b8c0cc', { r: 0.1 }); const g2 = at(f.a, c.y - 0.55, 0.55); pgx.box(f.ax === 'z' ? 1.1 : 1.6, 0.1, f.ax === 'z' ? 1.6 : 1.1, c.x, c.y - 0.5, c.z, '#5a606c', { r: 0 }); }
        if (R() < 0.5) { const c = at(f.a + 0.6 + R() * (len - 1.2), h / 2, 0.02); propAt(c.x, c.z).cyl(0.22, 0.22, h, c.x, h / 2, c.z, '#9aa2ae', { seg: 8 }); }
        // striped awning
        if (R() < 0.7) { const s = f.a + 2.5 + R() * (len - 10), wdt = 6 + R() * 2, c1 = POP[(R() * POP.length) | 0], pgx = propAt(...(f.ax === 'z' ? [f.px, s] : [s, f.px]));
          for (let q = 0; q < 6; q++) { const c = at(s + (q + 0.5) * wdt / 6, 4.9, 1.2); pgx.box(f.ax === 'z' ? 2.4 : wdt / 6, 0.14, f.ax === 'z' ? wdt / 6 : 2.4, c.x, c.y, c.z, q % 2 ? '#ffffff' : c1, { r: 0, rx: f.ax === 'x' ? -f.nz * 0.3 : 0, rz: f.ax === 'z' ? f.nx * 0.3 : 0 }); } }
        // vending machine / planter / bench on the sidewalk
        if (!outer) {
          const s = f.a + 2 + R() * (len - 4), kind = R(), pgx = propAt(...(f.ax === 'z' ? [f.px, s] : [s, f.px]));
          if (kind < 0.3) { const c = at(s, 1.15, 0.6), col = POP[(R() * POP.length) | 0], w2 = f.ax === 'z' ? [0.9, 1.3] : [1.3, 0.9]; pgx.box(w2[0], 2.3, w2[1], c.x, 1.15, c.z, col, { r: 0.1 }); const fc = at(s, 1.4, 1.06); pgx.box(f.ax === 'z' ? 0.05 : 1.0, 1.4, f.ax === 'z' ? 1.0 : 0.05, fc.x, 1.45, fc.z, '#e8f8ff', { e: 0.6, r: 0 }); W.colliders.push({ x0: c.x - w2[0] / 2, z0: c.z - w2[1] / 2, x1: c.x + w2[0] / 2, z1: c.z + w2[1] / 2, h: 2.3 }); }
          else if (kind < 0.6) { const c = at(s, 0, 1.1); for (let q = -1; q <= 1; q++) { const p = c.clone().add(along.clone().multiplyScalar(q * 1.1)); pgx.box(0.9, 0.8, 0.9, p.x, 0.55, p.z, '#c8805a', { r: 0.12 }); pgx.sph(0.55, p.x, 1.25, p.z, ['#ff5d8f', '#ffd23f', '#4cc04a', '#ff8a3d'][(R() * 4) | 0], { seg: 8, seg2: 6 }); } }
          else if (kind < 0.8) { const c = at(s, 0, 1.0); pgx.box(f.ax === 'z' ? 0.7 : 2.4, 0.15, f.ax === 'z' ? 2.4 : 0.7, c.x, 0.75, c.z, '#c9874a', { r: 0.05 }); pgx.box(f.ax === 'z' ? 0.12 : 2.4, 0.6, f.ax === 'z' ? 2.4 : 0.12, c.x + f.nx * -0.3, 1.1, c.z + f.nz * -0.3, '#c9874a', { r: 0.03 }); pgx.box(f.ax === 'z' ? 0.6 : 0.12, 0.7, f.ax === 'z' ? 0.12 : 0.6, c.x, 0.4, c.z, '#3a3f4a', { r: 0 }); }
        }
      }
    }
  }
  // ---------------- streets: lamps, trees, markings, traffic lights, cars, barriers
  const lampPost = (pg, x, z, dx, dz) => {
    pg.cyl(0.14, 0.2, 8, x, 4, z, '#3d6f8a', { seg: 8 }); pg.cyl(0.3, 0.36, 0.5, x, 0.25, z, '#2d4f62', { seg: 8 });
    pg.box(Math.abs(dx) * 2.4 + 0.16, 0.16, Math.abs(dz) * 2.4 + 0.16, x + dx * 1.1, 8, z + dz * 1.1, '#3d6f8a', { r: 0 });
    pg.box(0.8, 0.3, 0.8, x + dx * 2.3, 7.85, z + dz * 2.3, '#2d4f62', { r: 0.08 }); pg.box(0.6, 0.06, 0.6, x + dx * 2.3, 7.68, z + dz * 2.3, '#fff6d8', { e: 0.6, r: 0 });
    W.colliders.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35, h: 8 });
  };
  for (let a = 0; a <= 5; a++) for (let b = -1; b <= 5; b++) for (const tr of [false, true]) {
    const sx = S(a), z0 = S(b) + 12, z1 = S(b) + 48, mid = (z0 + z1) / 2, P = (u, v) => tr ? [v, u] : [u, v];
    if (b >= 0 && b <= 4) {
      const pg = propAt(...P(sx, mid));
      for (const sd of [-1, 1]) for (const v of [z0 + 6, z0 + 30]) { const [x, z] = P(sx + sd * 13.6, v + (sd > 0 ? 12 : 0)); const [dx, dz] = P(-sd, 0); lampPost(pg, x, z, dx, dz); }
      for (const sd of [-1, 1]) for (const v of [z0 + 12, z0 + 24]) { const [x, z] = P(sx + sd * 14.2, v + (sd > 0 ? 3 : -3)); if (!keepClear(x, z, 1)) { tree(pg, x, z, 1); W.colliders.push({ x0: x - 0.8, z0: z - 0.8, x1: x + 0.8, z1: z + 0.8, h: 5 }); } }
      for (let v = z0 + 1; v < z1 - 2; v += 6) { const [x, z] = P(sx, v + 1.5); pg.box(tr ? 3 : 0.3, 0.03, tr ? 0.3 : 3, x, 0.015, z, '#ffd23f', { r: 0 }); }
      for (const sd of [-1, 1]) { const [x, z] = P(sx + sd * 10.8, mid); pg.box(tr ? 36 : 0.22, 0.03, tr ? 0.22 : 36, x, 0.015, z, '#f4f4f4', { r: 0 }); }
      // bunting: colourful pennant lines strung across the street
      if (R() < 0.55) { const v = z0 + 6 + R() * 24, hgt = 13 + R() * 6, sag = 1.6, N = 16, pts = [];
        for (let q = 0; q <= N; q++) { const u = -14 + q / N * 28, [x, z] = P(sx + u, v); pts.push(V(x, hgt - Math.sin(q / N * Math.PI) * sag, z)); }
        pg.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.05, 4), '#3a3f4a', {});
        for (let q = 1; q < N; q++) { const p0 = pts[q]; pg.cyl(0.55, 0.0, 1.1, p0.x, p0.y - 0.6, p0.z, POP[(q + a + b) % POP.length], { seg: 3, sz: tr ? 1 : 0.12, sx: tr ? 0.12 : 1, ry: 0 }); } }
      // hydrant + bin + bus stop
      { const [x, z] = P(sx + (R() < 0.5 ? -1 : 1) * 12.9, z0 + 3 + R() * 30); pg.cyl(0.28, 0.32, 1.0, x, 0.5, z, '#ff3b3b', { seg: 10 }); pg.sph(0.3, x, 1.05, z, '#ff3b3b', { seg: 8, seg2: 6 }); pg.cyl(0.1, 0.1, 0.8, x, 0.65, z, '#ffd23f', { rz: Math.PI / 2, seg: 6 }); }
      if (R() < 0.6) { const [x, z] = P(sx + (R() < 0.5 ? -1 : 1) * 12.9, z0 + 3 + R() * 30); pg.cyl(0.42, 0.36, 1.1, x, 0.55, z, '#2ec46b', { seg: 10 }); pg.cyl(0.46, 0.46, 0.12, x, 1.12, z, '#1f9a50', { seg: 10 }); }
      if (R() < 0.35) { const sd = R() < 0.5 ? -1 : 1, v = z0 + 10 + R() * 16, [x, z] = P(sx + sd * 13.4, v), cell = atlas.cells.ad[(R() * 4) | 0];
        const m = new THREE.Matrix4().makeRotationY(tr ? 0 : Math.PI / 2).setPosition(x, 0, z);
        pg.box(5.2, 0.2, 2.0, 0, 3.2, 0, '#3a86ff', { r: 0.06, m }); for (const q of [-2.4, 2.4]) pg.box(0.15, 3.1, 0.15, q, 1.6, -0.8, '#dfe6ee', { r: 0, m }); pg.box(4.8, 0.12, 0.6, 0, 0.8, -0.5, '#c9874a', { r: 0.03, m });
        const pc = new THREE.Vector3(1.6, 1.8, -0.9).applyMatrix4(m), rr = new THREE.Vector3(1, 0, 0).transformDirection(m); quad(pc, rr, V(0, 1, 0), 0.75, 0.75, cell.uv); quad(pc.clone().add(V(0, 0, 0)), rr.clone().negate(), V(0, 1, 0), 0.75, 0.75, cell.uv); }
      // steam/manhole
      if (R() < 0.3) { const [x, z] = P(sx + (R() - 0.5) * 12, z0 + 6 + R() * 24); if (!keepClear(x, z, 3)) { pg.cyl(0.9, 0.9, 0.06, x, 0.02, z, '#4a4d55', { seg: 16 }); W.vents.push(V(x, 0.1, z)); } }
      // cover
      const nc = 1 + ((R() * 2.6) | 0);
      for (let k = 0; k < nc; k++) {
        const u = (R() < 0.5 ? -1 : 1) * (3 + R() * 6), v = z0 + 5 + R() * 26, [x, z] = P(sx + u, v);
        if (keepClear(x, z, 5)) continue;
        const kind = R(), rot = (R() - 0.5) * 0.3, pgc = propAt(x, z);
        if (kind < 0.35) {
          const w = 4.2, along = R() < 0.5, [bx, bz] = along === tr ? [w, 0.9] : [0.9, w];
          pgc.box(bx, 1.15, bz, x, 0.58, z, '#e8e4dc', { r: 0.18 });
          for (let q = -1; q <= 1; q++) pgc.box(bx > 1 ? 0.6 : bx + 0.02, 0.5, bx > 1 ? bz + 0.02 : 0.6, x + (bx > 1 ? q * 1.3 : 0), 0.7, z + (bx > 1 ? 0 : q * 1.3), '#ff5a3a', { r: 0.02 });
          W.colliders.push({ x0: x - bx / 2, z0: z - bz / 2, x1: x + bx / 2, z1: z + bz / 2, h: 1.2, cover: true });
        } else if (kind < 0.85) {
          const ry = (tr ? Math.PI / 2 : 0) + rot + (R() < 0.5 ? Math.PI : 0), col = POP[(R() * POP.length) | 0], m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
          if (R() < 0.5) {   // chunky hatchback
            pgc.box(2.3, 1.0, 4.6, 0, 0.85, 0, col, { r: 0.42, m }); pgc.box(2.0, 0.95, 2.6, 0, 1.75, -0.35, col, { r: 0.4, m }); pgc.box(2.06, 0.6, 2.3, 0, 1.8, -0.35, '#9fd8ff', { r: 0.25, m });
          } else {           // tiny van
            pgc.box(2.4, 2.2, 4.4, 0, 1.45, -0.2, col, { r: 0.45, m }); pgc.box(2.46, 0.8, 1.2, 0, 2.0, 1.5, '#9fd8ff', { r: 0.25, m }); pgc.box(2.5, 0.4, 2.4, 0, 1.6, -0.9, '#ffffff', { r: 0.1, m });
          }
          pgc.box(0.5, 0.25, 0.08, -0.7, 0.95, 2.3, '#fff6c8', { e: 0.8, r: 0.05, m }); pgc.box(0.5, 0.25, 0.08, 0.7, 0.95, 2.3, '#fff6c8', { e: 0.8, r: 0.05, m });
          pgc.box(2.36, 0.22, 0.25, 0, 0.55, 2.28, '#3a3f4a', { r: 0.08, m }); pgc.box(2.36, 0.22, 0.25, 0, 0.55, -2.28, '#3a3f4a', { r: 0.08, m });
          for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) { pgc.cyl(0.5, 0.5, 0.36, wx * 1.08, 0.5, wz, '#2a2d34', { rz: Math.PI / 2, seg: 14, m }); pgc.cyl(0.24, 0.24, 0.38, wx * 1.08, 0.5, wz, '#d8dde6', { rz: Math.PI / 2, seg: 10, m }); }
          const ex = tr ? 2.6 : 1.3, ez = tr ? 1.3 : 2.6; W.colliders.push({ x0: x - ex, z0: z - ez, x1: x + ex, z1: z + ez, h: 2.2, cover: true });
        } else {
          const col = ['#ff7b00', '#2ec4b6', '#3a86ff', '#ef476f'][(R() * 4) | 0], [bx, bz] = tr ? [6.1, 2.5] : [2.5, 6.1];
          pgc.box(bx, 2.6, bz, x, 1.3, z, col, { r: 0.08 });
          for (let q = -2; q <= 2; q++) pgc.box(tr ? 0.14 : 2.58, 2.45, tr ? 2.58 : 0.14, x + (tr ? q * 1.2 : 0), 1.3, z + (tr ? 0 : q * 1.2), col, { r: 0 });
          pgc.box(tr ? 3 : 2.62, 0.6, tr ? 2.62 : 3, x, 1.6, z, '#ffffff', { r: 0 });
          W.colliders.push({ x0: x - bx / 2, z0: z - bz / 2, x1: x + bx / 2, z1: z + bz / 2, h: 2.6, cover: true });
        }
      }
    }
    // crosswalk + traffic light
    if (b >= -1 && b <= 4) {
      const pg = propAt(...P(sx, z1 + 6));
      for (let q = -4; q <= 4; q++) { const [x, z] = P(sx + q * 2.4, z1 + 1.8); pg.box(tr ? 2.8 : 1.3, 0.03, tr ? 1.3 : 2.8, x, 0.016, z, '#ffffff', { r: 0 }); }
      if (!tr && b >= 0) { const [x, z] = P(sx + 12.8, z1 + 0.8); pg.cyl(0.15, 0.15, 6, x, 3, z, '#3a3f4a', { seg: 6 }); pg.box(0.7, 2.0, 0.7, x, 6.4, z, '#ffd23f', { r: 0.15 }); for (let q = 0; q < 3; q++) pg.sph(0.22, x, 7.0 - q * 0.6, z - 0.36, ['#ff3b3b', '#ffb000', '#2ee66b'][q], { e: q === 2 ? 2 : 0.2, seg: 8, seg2: 6 }); }
    }
  }
  // ---------------- plaza: tiles, fountain + statue, planters, cover
  {
    const pg = propAt(150, 150), tc = ['#f1e6cf', '#ffb38a', '#9ad9f0'];
    for (let q = 0; q < 9; q++) for (let r = 0; r < 9; r++) pg.box(3.95, 0.06, 3.95, 134 + q * 4, 0.03, 134 + r * 4, tc[(q * 3 + r * 7) % 3], { r: 0 });
    pg.cyl(6, 6.4, 1.0, 150, 0.5, 150, '#e8e4dc', { seg: 36 }); pg.cyl(5.4, 5.4, 0.2, 150, 0.95, 150, '#38b6ff', { seg: 36, e: 0.25 });
    pg.cyl(1.6, 2.2, 3.4, 150, 2.2, 150, '#ffffff', { seg: 20 }); pg.cyl(3, 3, 0.4, 150, 3.9, 150, '#38b6ff', { seg: 28, e: 0.25 });
    // statue: a stylised mech fist raised to the sky
    pg.box(1.8, 5, 1.8, 150, 6.5, 150, '#ffb703', { r: 0.5 }); pg.box(2.6, 2.4, 2.6, 150, 9.8, 150, '#ffb703', { r: 0.6 }); for (let q = 0; q < 4; q++) pg.box(0.5, 1.4, 0.6, 148.9 + q * 0.72, 11.6, 150.6, '#ffc93a', { r: 0.2 }); pg.tor(1.3, 0.25, 150, 5.6, 150, '#ff4d6d', { rx: Math.PI / 2, seg: 24 });
    W.colliders.push({ x0: 144, z0: 144, x1: 156, z1: 156, h: 3 });
    for (const [x, z] of [[138, 138], [162, 138], [138, 162], [162, 162]]) { pg.box(4.4, 1.1, 4.4, x, 0.55, z, '#c8805a', { r: 0.2 }); tree(pg, x, z, 1.1); W.colliders.push({ x0: x - 2.2, z0: z - 2.2, x1: x + 2.2, z1: z + 2.2, h: 1.6, cover: true }); }
    for (const [x, z, rx] of [[150, 135, 0], [150, 165, 0], [135, 150, 1], [165, 150, 1]]) { const [bx, bz] = rx ? [0.9, 5] : [5, 0.9]; pg.box(bx, 1.15, bz, x, 0.58, z, '#e8e4dc', { r: 0.18 }); pg.box(bx + 0.02, 0.4, bz + 0.02, x, 0.7, z, '#ff5a3a', { r: 0.02 }); W.colliders.push({ x0: x - bx / 2, z0: z - bz / 2, x1: x + bx / 2, z1: z + bz / 2, h: 1.2, cover: true }); }
    // cafe umbrellas
    for (const [x, z] of [[137, 150], [163, 150]]) for (const dz of [-6, 6]) { const c = POP[(R() * POP.length) | 0]; pg.cyl(0.06, 0.06, 2.6, x, 1.3, z + dz, '#ffffff', { seg: 5 }); pg.cyl(0.05, 1.7, 0.7, x, 2.75, z + dz, c, { seg: 10 }); pg.cyl(0.6, 0.6, 0.08, x, 0.8, z + dz, '#ffffff', { seg: 12 }); }
  }
  // ---------------- meshes
  const meshes = [];
  fac.forEach((t, i) => { if (!facGeos[i].length) return; const m = new THREE.Mesh(mergeGeometries(facGeos[i]), facMats[i]); m.castShadow = m.receiveShadow = true; meshes.push(m); });
  const storeMesh = new THREE.Mesh(mergeGeometries(storeGeos), storeMat); storeMesh.receiveShadow = true; storeMesh.castShadow = true; meshes.push(storeMesh);
  const propMat = mechMat({ map: false });
  W.propMeshes = [];
  for (const pg of props) if (!pg.empty) { const m = pg.mesh(propMat, true); meshes.push(m); W.propMeshes.push(m); if (!lite) addOutline(m, 0.05); }
  const walkMat = mechMat({ map: pavingTex() }); const wm = walk.mesh(walkMat, false); meshes.push(wm);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sgPos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(sgUv, 2)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(sgNrm, 3));
  const signs = new THREE.Mesh(sg, new THREE.MeshToonMaterial({ map: atlas.tex, gradientMap: toonGrad(), emissive: 0xffffff, emissiveMap: atlas.tex, emissiveIntensity: 0.35 })); signs.receiveShadow = true; meshes.push(signs);
  for (const m of meshes) scene.add(m);
  // ground
  const asp = asphaltTex(); asp.repeat.set(90, 90);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshToonMaterial({ map: asp, gradientMap: toonGrad(), color: 0xb8bcc8 })); ground.rotation.x = -Math.PI / 2; ground.position.set(150, 0, 150); ground.receiveShadow = true; scene.add(ground);
  W.ground = ground;

  // ---------------- sky: bright gradient, sun, stylised cel clouds
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0.5, 0.45, -0.6).normalize() } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform float uTime; uniform vec3 uSun; varying vec3 vD;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += nz(p) * a; p *= 2.03; a *= .5; } return s; }
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 top = vec3(.10, .36, .85), mid = vec3(.36, .66, .98), hor = vec3(1., .80, .62);
        vec3 c = mix(mid, top, smoothstep(.05, .7, y)); c = mix(hor, c, smoothstep(-.02, .28, y));
        float sd = max(dot(d, uSun), 0.); c += vec3(1., .75, .45) * pow(sd, 12.) * .6 + vec3(1., .95, .8) * smoothstep(.9975, .999, sd) * 3.;
        vec2 uv = d.xz / (max(y, .04) + .2) * 1.4 + vec2(uTime * .008, uTime * .003);
        float n = fbm(uv), cl = smoothstep(.5, .54, n) * smoothstep(.0, .2, y), cl2 = smoothstep(.6, .64, n);
        vec3 cc = mix(vec3(1., .86, .8), vec3(1.), cl2); cc = mix(cc, vec3(1., .93, .78), pow(sd, 3.) * .6);
        c = mix(c, cc, cl * .95);
        if (y < 0.) c = hor * .95;
        gl_FragColor = vec4(c, 1.); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat); sky.position.set(150, 0, 150); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  // skyline ring (fogged into the haze)
  const backGeos = [[], [], []];
  for (let k = 0; k < 160; k++) {
    const a = R() * Math.PI * 2, r = 360 + R() * 420, x = 150 + Math.cos(a) * r, z = 150 + Math.sin(a) * r, w = 22 + R() * 36, d = 22 + R() * 36, h = 60 + R() * R() * 300;
    facBox(backGeos[k % 3], x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 24, WALL[(R() * WALL.length) | 0]);
  }
  backGeos.forEach((gs, i) => scene.add(new THREE.Mesh(mergeGeometries(gs), facMats[i])));
  // flying traffic + a blimp
  const carG = (() => { const g = new GB(); g.box(2.6, 1.0, 5.6, 0, 0, 0, '#ffffff', { r: 0.45 }); g.box(1.9, 0.8, 2.6, 0, 0.7, -0.3, '#7fd0ff', { r: 0.35 }); g.box(2.0, 0.14, 0.1, 0, 0.05, 2.82, '#fff4c0', { e: 2, r: 0 }); g.box(2.4, 0.16, 0.1, 0, 0.1, -2.82, '#ff3050', { e: 2, r: 0 }); for (const s of [-1, 1]) { g.cyl(0.45, 0.45, 1.4, s * 1.55, -0.2, 0.6, '#3a3f4a', { rx: Math.PI / 2, seg: 10 }); g.cyl(0.32, 0.32, 0.05, s * 1.55, -0.2, -0.13, '#5ff0ff', { rx: Math.PI / 2, e: 3, seg: 10 }); } return g.build(); })();
  const NT = lite ? 36 : 60, traffic = new THREE.InstancedMesh(carG, mechMat({ map: false }), NT); traffic.frustumCulled = false; scene.add(traffic);
  const cars = [], cc = new THREE.Color();
  for (let k = 0; k < NT; k++) { const ax = R() < 0.5, lane = (R() * 8) | 0; cars.push({ ax, off: lane < 4 ? S(lane + 1) + (R() - 0.5) * 8 : -60 + R() * 420, y: 40 + ((R() * 5) | 0) * 9 + R() * 2, t: R() * 900, sp: (R() < 0.5 ? -1 : 1) * (20 + R() * 24) }); traffic.setColorAt(k, cc.set(POP[k % POP.length])); }
  const blimp = new THREE.Group(); { const g = new GB(); g.sph(8, 0, 0, 0, '#f4f1ea', { sx: 1, sy: 1, sz: 2.6, seg: 24, seg2: 14 }); for (let q = 0; q < 4; q++) g.box(0.4, 6, 5, 0, 0, -18, '#ff4d6d', { rz: q * Math.PI / 2, r: 0.1, m: new THREE.Matrix4().makeTranslation(0, 3, 0).premultiply(new THREE.Matrix4().makeRotationZ(q * Math.PI / 2)) }); g.box(3, 2.2, 7, 0, -8.6, 2, '#3a86ff', { r: 0.6 }); g.box(0.3, 4, 18, 8.1, 0, 0, '#ffd23f', { r: 0.1 }); g.box(0.3, 4, 18, -8.1, 0, 0, '#ffd23f', { r: 0.1 }); const bm = g.mesh(mechMat({ map: false }), false); blimp.add(bm); addOutline(bm, 0.2); }
  { const cell = atlas.cells.h[0]; const bq = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.6), new THREE.MeshBasicMaterial({ map: atlas.tex })); bq.geometry.attributes.uv.array.set([cell.uv[0], cell.uv[3], cell.uv[2], cell.uv[3], cell.uv[0], cell.uv[1], cell.uv[2], cell.uv[1]]); bq.position.set(8.3, 0, 0); bq.rotation.y = Math.PI / 2; blimp.add(bq); const bq2 = bq.clone(); bq2.position.x = -8.3; bq2.rotation.y = -Math.PI / 2; blimp.add(bq2); }
  scene.add(blimp);

  const dummy = new THREE.Object3D();
  W.update = (t) => {
    skyMat.uniforms.uTime.value = t;
    for (let k = 0; k < NT; k++) {
      const c = cars[k], s = ((c.t + t * c.sp) % 900 + 900) % 900 - 300;
      if (c.ax) { dummy.position.set(s, c.y, c.off); dummy.rotation.set(0, c.sp > 0 ? Math.PI / 2 : -Math.PI / 2, 0); } else { dummy.position.set(c.off, c.y, s); dummy.rotation.set(0, c.sp > 0 ? 0 : Math.PI, 0); }
      dummy.rotation.z = Math.sin(t * 0.7 + k) * 0.05; dummy.updateMatrix(); traffic.setMatrixAt(k, dummy.matrix);
    }
    traffic.instanceMatrix.needsUpdate = true;
    const ba = t * 0.02; blimp.position.set(150 + Math.cos(ba) * 170, 95 + Math.sin(t * 0.3) * 2, 150 + Math.sin(ba) * 170); blimp.rotation.y = -ba;
  };
  W.skyMat = skyMat;
  return W;
}

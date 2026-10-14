// Pearl Tide — original symbol art, drawn in code on 2D canvases (sea-life sticker style). No external images.
const INK = 'rgba(43,45,66,.92)';
function grad(ctx, y0, y1, a, b) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function sticker(ctx, path, fill, { white = 22, ink = 7 } = {}) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  path(); ctx.shadowColor = 'rgba(30,20,60,.28)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 7;
  ctx.lineWidth = white; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.shadowColor = 'transparent';
  path(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = ink; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
}
function shine(ctx, x, y, rx, ry, rot = -0.5, a = 0.55) {
  ctx.save(); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function eyes(ctx, x, y, gap = 30, r = 13) {
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * gap / 2, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#2b2d42'; ctx.beginPath(); ctx.arc(x + s * gap / 2 + 2, y + 2, r * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + s * gap / 2 + 5, y - 3, r * 0.24, 0, Math.PI * 2); ctx.fill();
  }
}
function smile(ctx, x, y, w = 14) { ctx.save(); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y - 4, w, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke(); ctx.restore(); }
function blush(ctx, x, y, gap) { ctx.fillStyle = 'rgba(255,90,140,.45)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * gap / 2, y, 11, 7, 0, 0, 7); ctx.fill(); } }
function sparkle(ctx, x, y, r, c = '#fff') {
  ctx.save(); ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function ribbon(ctx, text, y, fill, font) {
  ctx.save(); ctx.font = `800 46px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.max(150, ctx.measureText(text).width + 50), x = 128 - w / 2;
  ctx.beginPath(); ctx.roundRect(x, y - 27, w, 54, 27); ctx.lineWidth = 16; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.strokeText(text, 128, y + 3); ctx.fillText(text, 128, y + 3); ctx.restore();
}
function starPath(ctx, cx, cy, n, r1, r2, rot = -Math.PI / 2) {
  ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath();
}
function roundStarPath(ctx, cx, cy, r1, r2) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r2 : r1; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  ctx.beginPath(); const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[9], pts[0]); ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < 10; i++) { const p = pts[i], q = mid(p, pts[(i + 1) % 10]); ctx.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  ctx.closePath();
}

const DRAW = {
  glass(ctx) {
    const hex = (r) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(128 + Math.cos(a) * r, 130 + Math.sin(a) * r); } ctx.closePath(); };
    sticker(ctx, () => hex(84), grad(ctx, 50, 210, '#a6f7cf', '#1fae7a'));
    ctx.save(); hex(50); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 50, 130 + Math.sin(a) * 50); ctx.lineTo(128 + Math.cos(a) * 82, 130 + Math.sin(a) * 82); ctx.stroke(); }
    ctx.restore(); shine(ctx, 100, 92, 22, 10, -0.6, 0.7); sparkle(ctx, 170, 70, 16);
  },
  shell(ctx) {
    const cx = 128, cy = 150, base = [128, 214], n = 7, a0 = Math.PI + 0.28, a1 = 2 * Math.PI - 0.28;
    const P = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const path = () => { ctx.beginPath(); ctx.moveTo(base[0] - 16, base[1]); let p = P(a0, 96); ctx.lineTo(p[0], p[1]);
      for (let k = 0; k < n; k++) { const am = a0 + (k + 0.5) * (a1 - a0) / n, c = P(am, 124), q = P(a0 + (k + 1) * (a1 - a0) / n, 96); ctx.quadraticCurveTo(c[0], c[1], q[0], q[1]); }
      ctx.lineTo(base[0] + 16, base[1]); ctx.closePath(); };
    sticker(ctx, path, grad(ctx, 40, 214, '#ffe1c4', '#ff8f6b'));
    ctx.save(); ctx.strokeStyle = 'rgba(200,80,60,.45)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let k = 0; k <= n; k++) { const q = P(a0 + k * (a1 - a0) / n, 92); ctx.beginPath(); ctx.moveTo(128, 205); ctx.lineTo(q[0] * 0.85 + 128 * 0.15, q[1] * 0.85 + 205 * 0.15); ctx.stroke(); }
    ctx.restore(); shine(ctx, 96, 92, 20, 9, -0.7, 0.7);
  },
  drop(ctx) {
    const path = () => { ctx.beginPath(); ctx.moveTo(128, 34); ctx.bezierCurveTo(140, 70, 202, 120, 202, 162); ctx.arc(128, 162, 74, 0, Math.PI); ctx.bezierCurveTo(54, 120, 116, 70, 128, 34); ctx.closePath(); };
    sticker(ctx, path, grad(ctx, 34, 236, '#a9e2ff', '#2f6fe0'));
    shine(ctx, 100, 150, 16, 34, 0.25, 0.6); shine(ctx, 160, 195, 9, 6, 0, 0.45);
  },
  urchin(ctx) {
    sticker(ctx, () => starPath(ctx, 128, 132, 18, 104, 70, 0), grad(ctx, 30, 236, '#d6b8ff', '#7b2cbf'), { white: 18 });
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 18 + (i % 3) * 14; ctx.beginPath(); ctx.arc(128 + Math.cos(a) * r, 132 + Math.sin(a) * r, 6, 0, 7); ctx.fill(); } ctx.restore();
    shine(ctx, 100, 100, 18, 9, -0.6, 0.6);
  },
  star(ctx) {
    sticker(ctx, () => roundStarPath(ctx, 128, 136, 112, 52), grad(ctx, 24, 236, '#ffd27a', '#ff7b00'));
    ctx.fillStyle = 'rgba(255,255,255,.45)'; for (const [x, y] of [[128, 62], [62, 118], [194, 118], [88, 196], [168, 196]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); }
    eyes(ctx, 128, 128, 34, 13); smile(ctx, 128, 162, 12); blush(ctx, 128, 152, 64);
  },
  jelly(ctx) {
    ctx.save(); ctx.lineCap = 'round';
    for (const [x, w] of [[86, 1], [112, -1], [144, 1], [170, -1]]) {
      const t = () => { ctx.beginPath(); ctx.moveTo(x, 150); ctx.bezierCurveTo(x + 18 * w, 180, x - 18 * w, 205, x + 6 * w, 236); };
      t(); ctx.lineWidth = 26; ctx.strokeStyle = '#fff'; ctx.stroke(); t(); ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.stroke(); t(); ctx.lineWidth = 10; ctx.strokeStyle = '#ff8fc4'; ctx.stroke();
    }
    ctx.restore();
    const dome = () => { ctx.beginPath(); ctx.moveTo(40, 150); ctx.bezierCurveTo(40, 40, 216, 40, 216, 150);
      for (let i = 0; i < 6; i++) { const x0 = 216 - i * 176 / 6, x1 = x0 - 176 / 6; ctx.quadraticCurveTo((x0 + x1) / 2, 170, x1, 150); } ctx.closePath(); };
    sticker(ctx, dome, grad(ctx, 40, 170, '#ffc9e5', '#ff4f9a'));
    shine(ctx, 92, 82, 24, 11, -0.5, 0.65); eyes(ctx, 128, 112, 36, 13); smile(ctx, 128, 140, 10); blush(ctx, 128, 132, 70);
  },
  puff(ctx) {
    sticker(ctx, () => starPath(ctx, 128, 132, 14, 102, 84, 0), '#ffd23f', { white: 18 });
    sticker(ctx, () => { ctx.beginPath(); ctx.arc(128, 132, 82, 0, Math.PI * 2); }, grad(ctx, 50, 214, '#fff3a6', '#ffb703'), { white: 0 });
    ctx.save(); ctx.beginPath(); ctx.ellipse(128, 176, 52, 30, 0, 0, Math.PI); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill(); ctx.restore();
    sticker(ctx, () => { ctx.beginPath(); ctx.ellipse(36, 140, 16, 26, -0.4, 0, 7); }, '#ff9f1c', { white: 10, ink: 5 });
    sticker(ctx, () => { ctx.beginPath(); ctx.ellipse(220, 140, 16, 26, 0.4, 0, 7); }, '#ff9f1c', { white: 10, ink: 5 });
    eyes(ctx, 128, 116, 46, 17);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(128, 160, 9, 11, 0, 0, 7); ctx.fill(); blush(ctx, 128, 146, 84);
    shine(ctx, 88, 80, 18, 9, -0.6, 0.65);
  },
  clam(ctx) {
    const lower = () => { ctx.beginPath(); ctx.moveTo(30, 136); ctx.quadraticCurveTo(128, 260, 226, 136); ctx.closePath(); };
    const upper = () => { ctx.beginPath(); ctx.moveTo(34, 128); ctx.bezierCurveTo(40, 20, 216, 20, 222, 128); ctx.quadraticCurveTo(128, 104, 34, 128); ctx.closePath(); };
    sticker(ctx, upper, grad(ctx, 30, 130, '#f7c6ff', '#a66cff'));
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(128, 118); ctx.lineTo(128 + i * 40, 46 + Math.abs(i) * 14); ctx.stroke(); } ctx.restore();
    sticker(ctx, lower, grad(ctx, 130, 220, '#e7b2ff', '#7b3fe4'));
    const pg = ctx.createRadialGradient(112, 126, 6, 128, 140, 46); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.55, '#fde7ff'); pg.addColorStop(1, '#c6b6ff');
    sticker(ctx, () => { ctx.beginPath(); ctx.arc(128, 142, 40, 0, 7); }, pg, { white: 10, ink: 5 });
    shine(ctx, 114, 128, 12, 7, -0.6, 0.9); sparkle(ctx, 182, 92, 18); sparkle(ctx, 72, 186, 12);
  },
  wild(ctx, font) {
    const badge = () => { ctx.beginPath(); ctx.roundRect(26, 30, 204, 172, 44); };
    sticker(ctx, badge, grad(ctx, 30, 200, '#fff08a', '#ff9f1c'));
    ctx.save(); badge(); ctx.clip();
    ctx.fillStyle = '#2ec4d6'; ctx.beginPath(); ctx.moveTo(26, 200); ctx.lineTo(26, 150); ctx.bezierCurveTo(60, 120, 90, 150, 110, 120);
    ctx.bezierCurveTo(130, 80, 200, 70, 196, 120); ctx.bezierCurveTo(194, 140, 170, 146, 160, 132); ctx.bezierCurveTo(176, 126, 172, 104, 156, 108);
    ctx.bezierCurveTo(136, 112, 150, 170, 230, 150); ctx.lineTo(230, 200); ctx.closePath(); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore(); shine(ctx, 70, 60, 26, 10, -0.3, 0.6); sparkle(ctx, 200, 58, 16);
    ribbon(ctx, 'WILD', 206, '#ff4f9a', font);
  },
  pearl(ctx, font) {
    ctx.save(); const halo = ctx.createRadialGradient(128, 112, 40, 128, 112, 124); halo.addColorStop(0, 'rgba(190,170,255,.7)'); halo.addColorStop(1, 'rgba(190,170,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 256, 256); ctx.restore();
    const pg = ctx.createRadialGradient(100, 84, 8, 128, 112, 86); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.45, '#f4ecff'); pg.addColorStop(0.75, '#cfe6ff'); pg.addColorStop(1, '#b49cff');
    sticker(ctx, () => { ctx.beginPath(); ctx.arc(128, 112, 78, 0, 7); }, pg);
    ctx.save(); ctx.globalAlpha = 0.35; const ir = ctx.createLinearGradient(60, 60, 200, 170); ir.addColorStop(0, '#ffb3e6'); ir.addColorStop(0.5, '#b3fff0'); ir.addColorStop(1, '#c2b3ff');
    ctx.fillStyle = ir; ctx.beginPath(); ctx.arc(128, 112, 74, 0, 7); ctx.fill(); ctx.restore();
    shine(ctx, 98, 80, 24, 13, -0.6, 0.95); sparkle(ctx, 200, 50, 20); sparkle(ctx, 52, 64, 13); sparkle(ctx, 206, 160, 11);
    ribbon(ctx, 'BONUS', 206, '#7b5cff', font);
  },
};

export function drawSymbol(id, font = "'Baloo 2', system-ui, sans-serif", size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.scale(size / 256, size / 256); DRAW[id](ctx, font); return c;
}
/** vertical motion-smear version of a symbol (used while a reel spins fast) */
export function smear(src) {
  const c = document.createElement('canvas'); c.width = c.height = src.width; const ctx = c.getContext('2d'), n = 9;
  for (let i = 0; i < n; i++) { ctx.globalAlpha = 1.6 / n; ctx.drawImage(src, 0, (i - n / 2) * src.height * 0.045); }
  return c;
}
export function logoCanvas(font) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, 256); bg.addColorStop(0, '#5b4bc4'); bg.addColorStop(1, '#2b2168');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 26; i++) { const x = (i * 197) % 1024, y = (i * 89) % 256, r = 4 + (i % 5) * 4; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  ctx.font = `800 150px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tg = ctx.createLinearGradient(0, 50, 0, 200); tg.addColorStop(0, '#fff7c2'); tg.addColorStop(0.5, '#ffd23f'); tg.addColorStop(1, '#ff9f1c');
  ctx.lineJoin = 'round'; ctx.lineWidth = 30; ctx.strokeStyle = '#fff'; ctx.strokeText('PEARL TIDE', 512, 140);
  ctx.lineWidth = 14; ctx.strokeStyle = '#2b2d42'; ctx.strokeText('PEARL TIDE', 512, 140); ctx.fillStyle = tg; ctx.fillText('PEARL TIDE', 512, 140);
  sparkle(ctx, 120, 60, 26); sparkle(ctx, 910, 196, 22); sparkle(ctx, 940, 52, 14);
  return c;
}
export function markerCanvas(n, color, font) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(48, 48, 42, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(48, 48, 34, 0, 7); ctx.fillStyle = color; ctx.fill();
  ctx.font = `800 46px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.strokeText(n, 48, 52); ctx.fillText(n, 48, 52);
  return c;
}
export function vignetteCanvas() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(30,20,70,.55)'); g.addColorStop(0.2, 'rgba(30,20,70,0)'); g.addColorStop(0.8, 'rgba(30,20,70,0)'); g.addColorStop(1, 'rgba(30,20,70,.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256); return c;
}
export function glowCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,160,1)'); g.addColorStop(0.5, 'rgba(255,200,80,.6)'); g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); return c;
}
export function raysCanvas() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 512);
  const h = ctx.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 512); return c;
}
export function frameCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,236,150,.55)'); g.addColorStop(1, 'rgba(255,200,80,.15)');
  ctx.beginPath(); ctx.roundRect(8, 8, 112, 112, 20); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = '#ffb703'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff6c9'; ctx.stroke(); return c;
}

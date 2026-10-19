// pictures.js — procedural jigsaw pictures for Knobble, all drawn in code (no images). Our own code, MIT.
// paint(ctx, S, seed) draws one square picture of size S×S and returns its title. Seven scene families, each with
// seeded palettes and layouts, so every level is a new picture.
export function rngOf(seed) {
  let s = ((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 5; i++) r();
  return r;
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
function vgrad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }
function ridge(r, n, rough) {   // midpoint displacement: n+1 heights in 0..1
  const h = new Array(n + 1).fill(0); h[0] = r(); h[n] = r();
  for (let step = n; step > 1; step >>= 1) { for (let i = step / 2; i < n; i += step) h[i] = (h[i - step / 2] + h[i + step / 2]) / 2 + (r() - 0.5) * rough * step / n; }
  return h;
}
function cloud(g, x, y, s, col = 'rgba(255,255,255,.9)') {
  g.fillStyle = col; g.beginPath();
  for (const [dx, dy, rr] of [[-0.5, 0.1, 0.32], [-0.15, -0.12, 0.42], [0.25, -0.05, 0.36], [0.55, 0.12, 0.26], [0, 0.18, 0.34]]) { g.moveTo(x + dx * s + rr * s, y + dy * s); g.arc(x + dx * s, y + dy * s, rr * s, 0, 7); }
  g.fill();
}
function star5(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); }

// ---------------------------------------------------------------- 1. mountain lake at golden hour
function peaks(g, S, r) {
  const P = pick(r, [
    { sky: ['#2b2d6e', '#c4589b', '#ffb36b'], sun: '#fff1b8', far: '#b07bb5', near: '#2a2450', lake: '#5a4a8a', tree: '#1c1838' },
    { sky: ['#3f7fd1', '#9fd3f2', '#fff0c9'], sun: '#ffffff', far: '#9fb8d8', near: '#2f5d55', lake: '#5b9bc4', tree: '#1f3f38' },
    { sky: ['#1d3b63', '#f2836b', '#ffd27a'], sun: '#fff4d1', far: '#d18b8b', near: '#3a2b3f', lake: '#6c5577', tree: '#22182a' },
    { sky: ['#5ec2d8', '#c7f0e4', '#fff8de'], sun: '#fffbe6', far: '#86c4b6', near: '#2c6650', lake: '#58b0b4', tree: '#18392d' },
  ]);
  const hz = S * 0.66;
  g.fillStyle = vgrad(g, 0, hz, P.sky); g.fillRect(0, 0, S, hz);
  const sx = S * (0.25 + r() * 0.5), sy = hz * (0.2 + r() * 0.14);
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, S * 0.35); glow.addColorStop(0, 'rgba(255,255,230,.65)'); glow.addColorStop(1, 'rgba(255,255,230,0)'); g.fillStyle = glow; g.fillRect(0, 0, S, hz);
  g.fillStyle = P.sun; g.beginPath(); g.arc(sx, sy, S * 0.07, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) cloud(g, S * r(), hz * (0.1 + r() * 0.35), S * (0.08 + r() * 0.08), 'rgba(255,255,255,.45)');
  for (let L = 0; L < 4; L++) {
    const h = ridge(r, 64, 2.2 - L * 0.45), base = hz - S * (0.2 - L * 0.055), amp = S * (0.3 - L * 0.07);
    g.fillStyle = mix(P.far, P.near, L / 3); g.beginPath(); g.moveTo(0, hz);
    h.forEach((v, i) => g.lineTo(i / 64 * S, base - v * amp + (L === 0 ? 0 : S * 0.05)));
    g.lineTo(S, hz); g.closePath(); g.fill();
    if (L === 0) { g.fillStyle = 'rgba(255,255,255,.55)'; h.forEach((v, i) => { if (v > 0.72 && i % 2 === 0) { const x = i / 64 * S, y = base - v * amp; g.beginPath(); g.moveTo(x, y); g.lineTo(x - S * 0.025, y + S * 0.03); g.lineTo(x + S * 0.025, y + S * 0.03); g.fill(); } }); }
  }
  // lake + reflection
  g.save(); g.translate(0, hz * 2); g.scale(1, -1); g.globalAlpha = 0.45; g.drawImage(g.canvas, 0, 0, g.canvas.width, g.canvas.height * hz / S, 0, 0, S, hz); g.restore();
  g.fillStyle = vgrad(g, hz, S, ['rgba(255,255,255,.08)', P.lake]); g.globalAlpha = 0.75; g.fillRect(0, hz, S, S - hz); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = S * 0.004;
  for (let i = 0; i < 26; i++) { const y = hz + S * 0.02 + r() * (S - hz) * 0.9, x = r() * S, w = S * (0.03 + r() * 0.08); g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); }
  // pines on the shore
  for (let i = 0; i < 18; i++) {
    const x = (i < 9 ? r() * 0.32 : 0.68 + r() * 0.32) * S, h = S * (0.08 + r() * 0.12), y = hz + S * 0.02;
    g.fillStyle = P.tree; g.beginPath(); for (let k = 0; k < 4; k++) { const yy = y - h * k / 4, w = h * 0.32 * (1 - k / 5); g.moveTo(x - w, yy); g.lineTo(x, yy - h * 0.42); g.lineTo(x + w, yy); } g.fill();
  }
  g.strokeStyle = P.tree; g.lineWidth = S * 0.004; g.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const x = S * (0.3 + r() * 0.4), y = hz * (0.15 + r() * 0.3), w = S * 0.018; g.beginPath(); g.moveTo(x - w, y - w * 0.5); g.quadraticCurveTo(x - w * 0.4, y - w * 0.7, x, y); g.quadraticCurveTo(x + w * 0.4, y - w * 0.7, x + w, y - w * 0.5); g.stroke(); }
  return 'Mountain lake';
}

// ---------------------------------------------------------------- 2. hot-air balloons over patchwork hills
function balloons(g, S, r) {
  const sky = pick(r, [['#7cc8f2', '#d9f1ff', '#fff3e0'], ['#f7b2c4', '#ffe1d2', '#fff8e8'], ['#9b8cf2', '#f5c6e4', '#ffe9cf']]);
  g.fillStyle = vgrad(g, 0, S, sky); g.fillRect(0, 0, S, S);
  for (let i = 0; i < 7; i++) cloud(g, S * r(), S * (0.08 + r() * 0.5), S * (0.07 + r() * 0.07));
  // hills with fields
  const fields = ['#9fd77c', '#c6e48b', '#7cc276', '#f2d27a', '#b8dc8c', '#e9b97a', '#8fcf9a'];
  for (let L = 0; L < 3; L++) {
    const h = ridge(r, 32, 0.6), base = S * (0.7 + L * 0.1);
    g.save(); g.beginPath(); g.moveTo(0, S); h.forEach((v, i) => g.lineTo(i / 32 * S, base - v * S * 0.12)); g.lineTo(S, S); g.closePath(); g.clip();
    // fields: bands that follow the hill, cut by slanted hedges
    const band = S * 0.035 * (1 + L * 0.6);
    for (let b = 0; b < 8; b++) { g.fillStyle = pick(r, fields); g.beginPath(); h.forEach((v, i) => g.lineTo(i / 32 * S, base - v * S * 0.12 + b * band)); for (let i = 32; i >= 0; i--) g.lineTo(i / 32 * S, base - h[i] * S * 0.12 + (b + 1) * band); g.fill(); }
    g.strokeStyle = 'rgba(70,120,60,.45)'; g.lineWidth = S * 0.004; for (let k = 0; k < 7; k++) { const x0 = r() * S; g.beginPath(); g.moveTo(x0, base - S * 0.15); g.lineTo(x0 + (x0 - S / 2) * 0.5, S); g.stroke(); }
    g.fillStyle = `rgba(255,255,255,${0.18 - L * 0.06})`; g.fillRect(0, 0, S, S); g.restore();
    for (let k = 0; k < 6; k++) { const tx = r() * S, ty = base - h[Math.min(32, Math.round(tx / S * 32))] * S * 0.12 + S * 0.02; g.fillStyle = '#4f9a5a'; g.beginPath(); g.arc(tx, ty - S * 0.015, S * 0.014 * (1 + L * 0.3), 0, 7); g.fill(); }
  }
  // balloons
  const pal = [['#ff5d73', '#ffd23f'], ['#3a86ff', '#ffffff'], ['#7b5cff', '#ff9ec7'], ['#2fbf8f', '#ffe066'], ['#ff8c42', '#3ec3d6'], ['#ff4fa3', '#ffffff'], ['#ffd23f', '#3a86ff']];
  const N = 6 + Math.floor(r() * 3), spots = [];
  for (let i = 0; i < N; i++) {
    let x, y, s, tries = 0;
    do { s = S * (0.05 + r() * 0.08); x = S * (0.1 + r() * 0.8); y = S * (0.12 + r() * 0.5); tries++; } while (tries < 30 && spots.some(p => Math.hypot(p[0] - x, p[1] - y) < (p[2] + s) * 1.4));
    spots.push([x, y, s]);
  }
  spots.sort((a, b) => a[2] - b[2]).forEach(([x, y, s], i) => {
    const [c1, c2] = pal[i % pal.length];
    const env = () => { g.beginPath(); g.moveTo(x, y + s * 1.25); g.bezierCurveTo(x - s * 0.5, y + s * 0.85, x - s * 1.05, y + s * 0.3, x - s, y - s * 0.2); g.bezierCurveTo(x - s * 0.95, y - s * 1.15, x + s * 0.95, y - s * 1.15, x + s, y - s * 0.2); g.bezierCurveTo(x + s * 1.05, y + s * 0.3, x + s * 0.5, y + s * 0.85, x, y + s * 1.25); };
    g.save(); env(); g.clip(); g.fillStyle = c1; g.fillRect(x - s * 1.2, y - s * 1.2, s * 2.4, s * 2.6);
    g.fillStyle = c2; for (let k = -3; k <= 3; k += 2) { g.beginPath(); g.ellipse(x, y, Math.abs(k) * s * 0.2 + s * 0.1, s * 1.4, 0, 0, 7); if (k < 0) g.fill(); }
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x, y, s * (0.25 + k * 0.32), s * 1.4, 0, 0, 7); g.lineWidth = s * 0.12; g.strokeStyle = k % 2 ? c2 : c1; g.stroke(); }
    const sh = g.createLinearGradient(x - s, 0, x + s, 0); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = sh; g.fillRect(x - s * 1.2, y - s * 1.2, s * 2.4, s * 2.6);
    g.restore();
    g.strokeStyle = 'rgba(80,50,30,.7)'; g.lineWidth = Math.max(1, s * 0.03); g.beginPath(); g.moveTo(x - s * 0.3, y + s * 1.12); g.lineTo(x - s * 0.18, y + s * 1.5); g.moveTo(x + s * 0.3, y + s * 1.12); g.lineTo(x + s * 0.18, y + s * 1.5); g.stroke();
    g.fillStyle = '#a86a33'; g.fillRect(x - s * 0.2, y + s * 1.5, s * 0.4, s * 0.3); g.fillStyle = '#c98a4e'; g.fillRect(x - s * 0.22, y + s * 1.48, s * 0.44, s * 0.07);
  });
  return 'Balloon festival';
}

// ---------------------------------------------------------------- 3. coral reef
function reef(g, S, r) {
  const W = pick(r, [['#1fb5d6', '#0d6fa6', '#073e6b'], ['#3fd0c9', '#1784a8', '#0b3f66'], ['#5cc7f2', '#2a6fd1', '#1b2f7a']]);
  g.fillStyle = vgrad(g, 0, S, W); g.fillRect(0, 0, S, S);
  g.save(); g.globalAlpha = 0.12; g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) { const x = S * r(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + S * 0.08, 0); g.lineTo(x + S * 0.3 - S * 0.1, S); g.lineTo(x + S * 0.05, S); g.fill(); }
  g.restore();
  // sand
  const h = ridge(r, 32, 0.5); g.fillStyle = vgrad(g, S * 0.75, S, ['#f2d9a0', '#d9b77a']); g.beginPath(); g.moveTo(0, S); h.forEach((v, i) => g.lineTo(i / 32 * S, S * 0.8 - v * S * 0.08)); g.lineTo(S, S); g.fill();
  // seaweed + corals
  const cor = ['#ff6f91', '#ff9a5c', '#ffd23f', '#c77dff', '#ff4f79', '#7cf2c4'];
  for (let i = 0; i < 9; i++) { const x = S * (0.03 + r() * 0.94), y = S * (0.86 + r() * 0.08), hh = S * (0.18 + r() * 0.2); g.strokeStyle = pick(r, ['#2fbf71', '#58d68d', '#1e9e5a']); g.lineWidth = S * 0.018; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); for (let k = 1; k <= 8; k++) g.lineTo(x + Math.sin(k * 0.9 + i) * S * 0.02, y - hh * k / 8); g.stroke(); }
  const branch = (x, y, a, len, w, col, d) => { if (d > 4 || len < S * 0.01) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); branch(x2, y2, a - 0.45 - r() * 0.2, len * 0.75, w * 0.75, col, d + 1); branch(x2, y2, a + 0.45 + r() * 0.2, len * 0.75, w * 0.75, col, d + 1); };
  for (let i = 0; i < 6; i++) { const x = S * (0.08 + i * 0.16 + r() * 0.06), col = pick(r, cor); branch(x, S * 0.9, -Math.PI / 2, S * 0.07, S * 0.022, col, 0); }
  for (let i = 0; i < 5; i++) { const x = S * r(), y = S * (0.86 + r() * 0.06), rr = S * (0.035 + r() * 0.03); g.fillStyle = pick(r, cor); g.beginPath(); g.arc(x, y, rr, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x - rr * 0.6 + k * rr * 0.3, y - rr * 0.4, rr * 0.08, 0, 7); g.fill(); } }
  // fish
  const fishC = [['#ffb703', '#fb8500'], ['#ff6b9a', '#ffd1e0'], ['#8ecae6', '#ffffff'], ['#ffe066', '#3a86ff'], ['#c77dff', '#ffd6ff'], ['#ff7b54', '#ffffff']];
  for (let i = 0; i < 12; i++) {
    const x = S * (0.08 + r() * 0.84), y = S * (0.12 + r() * 0.6), s = S * (0.025 + r() * 0.04), dir = r() < 0.5 ? 1 : -1, [a, b] = pick(r, fishC);
    g.save(); g.translate(x, y); g.scale(dir, 1);
    g.fillStyle = a; g.beginPath(); g.moveTo(-s * 1.1, 0); g.lineTo(-s * 1.8, -s * 0.6); g.lineTo(-s * 1.8, s * 0.6); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(0, 0, s * 1.3, s * 0.8, 0, 0, 7); g.fill();
    g.save(); g.clip(); g.fillStyle = b; for (let k = -1; k <= 1; k++) g.fillRect(k * s * 0.6 - s * 0.12, -s, s * 0.24, s * 2); g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 0.7, -s * 0.15, s * 0.24, 0, 7); g.fill(); g.fillStyle = '#1b1b2f'; g.beginPath(); g.arc(s * 0.76, -s * 0.15, s * 0.12, 0, 7); g.fill();
    g.restore();
  }
  // turtle
  { const x = S * (0.3 + r() * 0.4), y = S * (0.3 + r() * 0.2), s = S * 0.09; g.fillStyle = '#7ccf8a'; for (const [dx, dy] of [[-0.8, -0.7], [0.8, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { g.beginPath(); g.ellipse(x + dx * s, y + dy * s, s * 0.45, s * 0.22, dx * dy > 0 ? 0.6 : -0.6, 0, 7); g.fill(); }
    g.beginPath(); g.arc(x, y - s * 1.05, s * 0.32, 0, 7); g.fill(); g.fillStyle = '#1b1b2f'; g.beginPath(); g.arc(x - s * 0.1, y - s * 1.12, s * 0.06, 0, 7); g.arc(x + s * 0.1, y - s * 1.12, s * 0.06, 0, 7); g.fill();
    g.fillStyle = '#5a8f3d'; g.beginPath(); g.ellipse(x, y, s * 0.8, s * 0.95, 0, 0, 7); g.fill(); g.fillStyle = '#86b84f'; for (const [dx, dy] of [[0, 0], [-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, s * 0.22, 0, 7); g.fill(); } }
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = S * 0.003;
  for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(S * r(), S * r() * 0.8, S * (0.004 + r() * 0.01), 0, 7); g.stroke(); }
  return 'Coral reef';
}

// ---------------------------------------------------------------- 4. mandala
function mandala(g, S, r) {
  const P = pick(r, [['#1d1b3a', '#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#f7f3e3'], ['#fff4e6', '#e76f51', '#f4a261', '#2a9d8f', '#264653', '#e9c46a'], ['#0b3954', '#ff5a5f', '#ffe066', '#c9f2c7', '#7bdff2', '#f7f7ff'], ['#f9f1ff', '#7b2cbf', '#ff6d00', '#00b4d8', '#ff006e', '#3a0ca3']]);
  g.fillStyle = P[0]; g.fillRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  // corner fans
  for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) for (let k = 6; k > 0; k--) { g.fillStyle = P[1 + (k % 5)]; g.globalAlpha = 0.85; g.beginPath(); g.arc(x, y, S * 0.05 * k, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const rings = 7;
  for (let k = rings; k >= 1; k--) {
    const R = S * 0.48 * k / rings, n = [8, 10, 12, 16][Math.floor(r() * 4)], col = P[1 + ((k + 1) % 5)], col2 = P[1 + ((k + 3) % 5)], kind = Math.floor(r() * 3);
    g.fillStyle = k % 2 ? P[0] : mix(P[0], col, 0.15); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + (k % 2) * Math.PI / n;
      g.save(); g.translate(cx, cy); g.rotate(a);
      const w = R * Math.sin(Math.PI / n) * 0.9, len = S * 0.48 / rings;
      g.fillStyle = col;
      if (kind === 0) { g.beginPath(); g.moveTo(R - len, 0); g.quadraticCurveTo(R - len * 0.4, -w, R, 0); g.quadraticCurveTo(R - len * 0.4, w, R - len, 0); g.fill(); g.fillStyle = col2; g.beginPath(); g.arc(R - len * 0.45, 0, w * 0.22, 0, 7); g.fill(); }
      else if (kind === 1) { g.beginPath(); g.arc(R - len * 0.5, 0, Math.min(w, len) * 0.45, 0, 7); g.fill(); g.fillStyle = col2; g.beginPath(); g.arc(R - len * 0.5, 0, Math.min(w, len) * 0.2, 0, 7); g.fill(); }
      else { g.beginPath(); g.moveTo(R - len, -w * 0.7); g.lineTo(R, 0); g.lineTo(R - len, w * 0.7); g.closePath(); g.fill(); g.fillStyle = col2; g.beginPath(); g.moveTo(R - len, -w * 0.3); g.lineTo(R - len * 0.4, 0); g.lineTo(R - len, w * 0.3); g.fill(); }
      g.restore();
    }
  }
  g.fillStyle = P[2]; g.beginPath(); g.arc(cx, cy, S * 0.04, 0, 7); g.fill(); star5(g, cx, cy, S * 0.03, P[5]);
  return 'Mandala';
}

// ---------------------------------------------------------------- 5. patchwork quilt
function quilt(g, S, r) {
  const P = pick(r, [['#f6bd60', '#f7ede2', '#f5cac3', '#84a59d', '#f28482'], ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'], ['#ffcad4', '#b0d0d3', '#c08497', '#f7af9d', '#f3eec3'], ['#3d5a80', '#98c1d9', '#e0fbfc', '#ee6c4d', '#293241'], ['#606c38', '#fefae0', '#dda15e', '#bc6c25', '#283618']]);
  const n = 4 + Math.floor(r() * 2) * 2, c = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * c, y = j * c, a = P[Math.floor(r() * 5)]; let b = P[Math.floor(r() * 5)]; if (b === a) b = P[(P.indexOf(a) + 2) % 5];
    const k = Math.floor(r() * 7);
    g.fillStyle = a; g.fillRect(x, y, c, c); g.fillStyle = b;
    if (k === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + c, y); g.lineTo(x, y + c); g.fill(); }
    else if (k === 1) { g.beginPath(); g.arc(x + c / 2, y + c / 2, c * 0.32, 0, 7); g.fill(); g.fillStyle = a; g.beginPath(); g.arc(x + c / 2, y + c / 2, c * 0.14, 0, 7); g.fill(); }
    else if (k === 2) { for (let s = 0; s < 4; s++) if (s % 2) g.fillRect(x, y + s * c / 4, c, c / 4); }
    else if (k === 3) { g.beginPath(); g.moveTo(x + c / 2, y); g.lineTo(x + c, y + c / 2); g.lineTo(x + c / 2, y + c); g.lineTo(x, y + c / 2); g.fill(); }
    else if (k === 4) { star5(g, x + c / 2, y + c / 2 + c * 0.04, c * 0.36, b); }
    else if (k === 5) { g.beginPath(); g.arc(x, y + c, c * 0.9, -Math.PI / 2, 0); g.lineTo(x, y + c); g.fill(); g.fillStyle = a; g.beginPath(); g.arc(x, y + c, c * 0.55, -Math.PI / 2, 0); g.lineTo(x, y + c); g.fill(); g.fillStyle = b; g.beginPath(); g.arc(x, y + c, c * 0.25, -Math.PI / 2, 0); g.lineTo(x, y + c); g.fill(); }
    else { for (let p = 0; p < 2; p++) for (let q = 0; q < 2; q++) if ((p + q) % 2) g.fillRect(x + p * c / 2, y + q * c / 2, c / 2, c / 2); g.fillStyle = a; g.beginPath(); g.arc(x + c / 2, y + c / 2, c * 0.12, 0, 7); g.fill(); }
    // stitching
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([c * 0.05, c * 0.04]); g.lineWidth = Math.max(1, c * 0.012); g.strokeRect(x + c * 0.05, y + c * 0.05, c * 0.9, c * 0.9); g.setLineDash([]);
  }
  return 'Patchwork quilt';
}

// ---------------------------------------------------------------- 6. night village
function village(g, S, r) {
  const sky = pick(r, [['#0b1d51', '#3a3f8f', '#8a6fb8'], ['#101935', '#2e4a7d', '#4fa3a5'], ['#1a1033', '#4b2a6b', '#d0627a']]);
  g.fillStyle = vgrad(g, 0, S * 0.7, sky); g.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,240,${0.4 + r() * 0.6})`; const s = S * (0.0015 + r() * 0.004); g.fillRect(S * r(), S * r() * 0.6, s, s); }
  for (let i = 0; i < 6; i++) star5(g, S * r(), S * r() * 0.45, S * 0.008, '#fff7c2');
  const mx = S * (0.15 + r() * 0.7), my = S * (0.15 + r() * 0.12); const gl = g.createRadialGradient(mx, my, 0, mx, my, S * 0.2); gl.addColorStop(0, 'rgba(255,250,210,.5)'); gl.addColorStop(1, 'rgba(255,250,210,0)'); g.fillStyle = gl; g.fillRect(0, 0, S, S);
  g.fillStyle = '#fff6cf'; g.beginPath(); g.arc(mx, my, S * 0.06, 0, 7); g.fill(); g.fillStyle = 'rgba(200,190,150,.35)'; for (const [dx, dy, q] of [[-0.02, -0.01, 0.012], [0.015, 0.02, 0.008], [0.02, -0.02, 0.006]]) { g.beginPath(); g.arc(mx + dx * S, my + dy * S, q * S, 0, 7); g.fill(); }
  // hills
  for (let L = 0; L < 3; L++) { const h = ridge(r, 32, 0.5), base = S * (0.62 + L * 0.12); g.fillStyle = ['#2c3a6b', '#24305a', '#1c2547'][L]; g.beginPath(); g.moveTo(0, S); h.forEach((v, i) => g.lineTo(i / 32 * S, base - v * S * 0.1)); g.lineTo(S, S); g.fill();
    // houses on the hill
    const roof = ['#d1495b', '#edae49', '#00798c', '#66a182', '#8e7dbe', '#ef8354'], wall = ['#f2e8cf', '#e3d5ca', '#d6ccc2', '#f5ebe0', '#cdb4db'];
    for (let k = 0; k < 4 + L; k++) {
      const x = S * (0.05 + r() * 0.9), w = S * (0.07 + r() * 0.05) * (1 + L * 0.25), hh = w * (0.7 + r() * 0.5), y = base - h[Math.round(x / S * 32)] * S * 0.1 + S * 0.03;
      g.fillStyle = mix(pick(r, wall), '#1c2547', 0.25 - L * 0.08); g.fillRect(x - w / 2, y - hh, w, hh);
      g.fillStyle = pick(r, roof); g.beginPath(); g.moveTo(x - w * 0.62, y - hh); g.lineTo(x, y - hh - w * 0.55); g.lineTo(x + w * 0.62, y - hh); g.fill();
      g.fillStyle = '#ffd66b'; const ww = w * 0.2; for (const dx of [-0.25, 0.25]) if (r() < 0.8) { g.fillRect(x + dx * w - ww / 2, y - hh * 0.7, ww, ww); }
      g.fillStyle = '#5a3e2b'; g.fillRect(x - w * 0.09, y - hh * 0.35, w * 0.18, hh * 0.35);
      const glw = g.createRadialGradient(x, y - hh * 0.6, 0, x, y - hh * 0.6, w); glw.addColorStop(0, 'rgba(255,214,107,.18)'); glw.addColorStop(1, 'rgba(255,214,107,0)'); g.fillStyle = glw; g.fillRect(x - w, y - hh * 1.6, w * 2, w * 2);
    }
    for (let k = 0; k < 5; k++) { const x = S * r(), y = base - h[Math.round(x / S * 32)] * S * 0.1 + S * 0.04, s = S * 0.03 * (1 + L * 0.3); g.fillStyle = '#1b3b36'; g.beginPath(); g.moveTo(x, y - s * 2.4); g.lineTo(x + s * 0.7, y); g.lineTo(x - s * 0.7, y); g.fill(); }
  }
  for (let i = 0; i < 24; i++) { const x = S * r(), y = S * (0.65 + r() * 0.33); const gl2 = g.createRadialGradient(x, y, 0, x, y, S * 0.012); gl2.addColorStop(0, 'rgba(230,255,140,1)'); gl2.addColorStop(1, 'rgba(230,255,140,0)'); g.fillStyle = gl2; g.fillRect(x - S * 0.012, y - S * 0.012, S * 0.024, S * 0.024); }
  return 'Night village';
}

// ---------------------------------------------------------------- 7. cats in the windows (animals)
function cats(g, S, r) {
  const wallC = pick(r, ['#f4a7a7', '#9fd3c7', '#f6d186', '#b5a8e8', '#f7b98b']);
  g.fillStyle = wallC; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,0,0,.05)'; for (let y = 0; y < S; y += S / 40) for (let x = (y / (S / 40)) % 2 ? 0 : S / 24; x < S; x += S / 12) g.fillRect(x, y, S / 12 - 2, S / 40 - 2);
  const n = 3, cw = S / n;
  const furs = [{ f: '#f2a65a', s: '#d77f2f' }, { f: '#a7afbd', s: '#8b93a3' }, { f: '#3c3a46', s: null, light: true }, { f: '#fbf6ee', s: null, p: '#e8b27a' }, { f: '#e9d2ad', s: null, m: '#7a5a43' }, { f: '#c98d5c', s: '#a86a3b' }, { f: '#ffffff', s: null, p: '#3c3a46' }, { f: '#f7c99e', s: '#e7a46a' }, { f: '#8d8d99', s: null }];
  const frames = ['#ffffff', '#3d5a80', '#ee6c4d', '#2a9d8f', '#ffd166', '#6d597a'], curtains = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0', '#8338ec', '#fb5607'];
  const order = furs.slice().sort(() => r() - 0.5);
  for (let i = 0; i < 9; i++) {
    const x = (i % n) * cw + cw * 0.14, y = ((i / n) | 0) * cw + cw * 0.1, w = cw * 0.72, h = cw * 0.72, fr = pick(r, frames);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 4, y + 6, w, h);
    g.fillStyle = fr; g.fillRect(x - w * 0.06, y - w * 0.06, w * 1.12, h * 1.12);
    g.fillStyle = vgrad(g, y, y + h, ['#ffe9a8', '#ffc66b']); g.fillRect(x, y, w, h);
    // curtains
    const cc = pick(r, curtains); g.fillStyle = cc; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w * 0.3, y + h * 0.4, x + w * 0.08, y + h); g.lineTo(x, y + h); g.fill(); g.beginPath(); g.moveTo(x + w, y); g.quadraticCurveTo(x + w * 0.7, y + h * 0.4, x + w * 0.92, y + h); g.lineTo(x + w, y + h); g.fill();
    g.fillRect(x, y, w, h * 0.08);
    // cat
    const c = order[i], cx = x + w / 2, cy = y + h * 0.68, s = w * 0.36;
    g.fillStyle = c.f; g.beginPath(); g.ellipse(cx, cy + s * 0.75, s * 0.75, s * 0.6, 0, 0, 7); g.fill();
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * s * 0.75, cy - s * 0.2); g.lineTo(cx + sx * s * 0.62, cy - s * 0.95); g.lineTo(cx + sx * s * 0.2, cy - s * 0.6); g.fill(); }
    g.beginPath(); g.ellipse(cx, cy, s * 0.82, s * 0.65, 0, 0, 7); g.fill();
    if (c.p) { g.save(); g.beginPath(); g.ellipse(cx, cy, s * 0.82, s * 0.65, 0, 0, 7); g.clip(); g.fillStyle = c.p; g.beginPath(); g.ellipse(cx - s * 0.45, cy - s * 0.3, s * 0.45, s * 0.38, 0, 0, 7); g.fill(); g.restore(); }
    if (c.m) { g.fillStyle = c.m; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(cx, cy + s * 0.2, s * 0.35, s * 0.3, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
    if (c.s) { g.strokeStyle = c.s; g.lineWidth = s * 0.08; for (const dx of [-0.15, 0, 0.15]) { g.beginPath(); g.moveTo(cx + dx * s, cy - s * 0.62); g.lineTo(cx + dx * s * 0.8, cy - s * 0.35); g.stroke(); } }
    g.fillStyle = '#ffb3c1'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * s * 0.62, cy - s * 0.35); g.lineTo(cx + sx * s * 0.57, cy - s * 0.78); g.lineTo(cx + sx * s * 0.3, cy - s * 0.52); g.fill(); }
    const ink = c.light ? '#f6eedf' : '#3b2a2a', mood = Math.floor(r() * 3);
    for (const sx of [-1, 1]) {
      if (mood === 1) { g.strokeStyle = ink; g.lineWidth = s * 0.07; g.lineCap = 'round'; g.beginPath(); g.arc(cx + sx * s * 0.3, cy - s * 0.05, s * 0.11, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else { g.fillStyle = c.light ? '#f2d65a' : '#3b2a2a'; g.beginPath(); g.ellipse(cx + sx * s * 0.3, cy - s * 0.05, s * 0.1, s * 0.13, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + sx * s * 0.3 + s * 0.03, cy - s * 0.1, s * 0.035, 0, 7); g.fill(); }
    }
    g.fillStyle = '#f27f95'; g.beginPath(); g.moveTo(cx - s * 0.07, cy + s * 0.12); g.lineTo(cx + s * 0.07, cy + s * 0.12); g.lineTo(cx, cy + s * 0.2); g.fill();
    g.strokeStyle = ink; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(cx, cy + s * 0.2); g.quadraticCurveTo(cx - s * 0.02, cy + s * 0.3, cx - s * 0.12, cy + s * 0.28); g.moveTo(cx, cy + s * 0.2); g.quadraticCurveTo(cx + s * 0.02, cy + s * 0.3, cx + s * 0.12, cy + s * 0.28); g.stroke();
    if (mood === 2) { g.fillStyle = pick(r, ['#ff5d8f', '#3a86ff', '#ffd23f']); g.beginPath(); g.moveTo(cx + s * 0.55, cy - s * 0.65); g.lineTo(cx + s * 0.9, cy - s * 0.8); g.lineTo(cx + s * 0.9, cy - s * 0.5); g.closePath(); g.moveTo(cx + s * 0.55, cy - s * 0.65); g.lineTo(cx + s * 0.25, cy - s * 0.85); g.lineTo(cx + s * 0.25, cy - s * 0.5); g.fill(); }
    // window sill with a flower pot
    g.fillStyle = fr; g.fillRect(x - w * 0.12, y + h * 1.04, w * 1.24, h * 0.08);
    if (r() < 0.7) { const px = x + w * (r() < 0.5 ? 0.12 : 0.88); g.fillStyle = '#c96f4a'; g.fillRect(px - w * 0.07, y + h * 0.9, w * 0.14, h * 0.14); g.fillStyle = pick(r, curtains); for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(px + (k - 1) * w * 0.06, y + h * 0.84, w * 0.04, 0, 7); g.fill(); } }
  }
  return 'Window cats';
}

const SCENES = [peaks, balloons, reef, mandala, cats, village, quilt];
export function paint(ctx, S, seed) {
  const r = rngOf(seed), i = Math.floor(rngOf(seed * 7 + 1)() * SCENES.length);
  ctx.save(); const t = SCENES[i](ctx, S, r); ctx.restore(); return t;
}
export function paintScene(ctx, S, seed, i) { const r = rngOf(seed); ctx.save(); const t = SCENES[i % SCENES.length](ctx, S, r); ctx.restore(); return t; }
export const SCENE_COUNT = SCENES.length;

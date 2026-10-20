// Koi Court tile faces: 36 large, high-contrast garden pictograms + the golden koi treasure, drawn in code onto one
// canvas atlas (colour map) and a matching engraving atlas (bump map) so the symbols look carved into ivory.
// Every symbol is our own drawing. Order = most distinct first (early levels draw from the front of the list).
export const COLS = 8, ROWS = 5, CW = 256, CH = 344;
export const TREASURE = 36;

const INK = '#3a2418';
const P = Math.PI;

// helpers in a 100x100 space centred on 0,0 (the cell scales it)
function poly(x, pts) { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); }
function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, P * 2); }
function ell(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, P * 2); }
function fs(x, fill, lw = 4.5) { x.fillStyle = fill; x.fill(); if (lw) { x.lineWidth = lw; x.strokeStyle = INK; x.stroke(); } }
function grad(x, y0, y1, a, b) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function rgrad(x, cx, cy, r, a, b) { const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function petal(x, ang, len, wid, fill) {
  x.save(); x.rotate(ang); x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(wid, -len * 0.3, wid * 0.9, -len * 0.85, 0, -len); x.bezierCurveTo(-wid * 0.9, -len * 0.85, -wid, -len * 0.3, 0, 0);
  fs(x, fill); x.restore();
}
function shine(x, cx, cy, rx, ry, rot = -0.5) { x.save(); x.globalAlpha = 0.55; ell(x, cx, cy, rx, ry, rot); x.fillStyle = '#fff'; x.fill(); x.restore(); }

export const SYMBOLS = [
  { id: 'koi', name: 'Koi', col: '#ff7a1a', draw(x) {
    // tail
    poly(x, [[22, 0], [44, -20], [38, 0], [44, 20]]); fs(x, '#ff8f3a');
    ell(x, -4, 0, 32, 19); fs(x, grad(x, -19, 19, '#ffa04a', '#ff5a10'));
    x.save(); ell(x, -4, 0, 32, 19); x.clip(); ell(x, 6, -8, 11, 8); x.fillStyle = '#fff6ea'; x.fill(); ell(x, -18, 9, 9, 6); x.fill(); x.restore();
    ell(x, -4, 0, 32, 19); x.lineWidth = 4.5; x.strokeStyle = INK; x.stroke();
    poly(x, [[-2, 16], [8, 30], [12, 15]]); fs(x, '#ff8f3a', 3.5);
    poly(x, [[-6, -17], [6, -32], [12, -16]]); fs(x, '#ff8f3a', 3.5);
    circ(x, -24, -4, 4.6); fs(x, '#fff', 2.5); circ(x, -24, -4, 2.2); x.fillStyle = INK; x.fill();
    x.beginPath(); x.moveTo(-36, 6); x.quadraticCurveTo(-44, 12, -40, 20); x.lineWidth = 2.5; x.strokeStyle = INK; x.stroke();
  } },
  { id: 'bamboo', name: 'Bamboo', col: '#38a845', draw(x) {
    for (const [bx, top, w] of [[-18, -40, 11], [0, -46, 12], [18, -34, 11]]) {
      x.beginPath(); x.roundRect(bx - w / 2, top, w, 86 + (top + 40) * -1 - (top + 40) * 0 , 4); fs(x, grad(x, top, 44, '#7fd36b', '#2f9a3c'), 3.6);
      for (let y = top + 22; y < 42; y += 22) { x.beginPath(); x.moveTo(bx - w / 2 - 1, y); x.lineTo(bx + w / 2 + 1, y); x.lineWidth = 3.6; x.strokeStyle = INK; x.stroke(); }
    }
    for (const [lx, ly, a] of [[6, -30, -0.6], [-12, -10, 3.6], [24, 2, -0.3]]) { x.save(); x.translate(lx, ly); x.rotate(a); ell(x, 12, 0, 13, 4.5); fs(x, '#56c255', 3); x.restore(); }
  } },
  { id: 'lotus', name: 'Lotus', col: '#ff6fa8', draw(x) {
    ell(x, 0, 26, 42, 12); fs(x, '#4fb35a');
    x.translate(0, 18);
    for (const a of [-1.15, 1.15]) petal(x, a, 40, 15, '#ffb3d0');
    for (const a of [-0.55, 0.55]) petal(x, a, 46, 15, '#ff8fbd');
    petal(x, 0, 50, 15, '#ff6fa8');
    x.translate(0, -18);
  } },
  { id: 'wave', name: 'Wave', col: '#2e86de', draw(x) {
    x.beginPath(); x.moveTo(-44, 34); x.bezierCurveTo(-40, -10, -10, -42, 18, -36); x.bezierCurveTo(42, -32, 44, -6, 28, 0);
    x.bezierCurveTo(18, 4, 8, -8, 18, -16); x.bezierCurveTo(0, -18, -14, 4, -4, 22); x.bezierCurveTo(10, 36, 34, 30, 44, 22); x.lineTo(44, 34); x.closePath();
    fs(x, grad(x, -40, 34, '#5fb0ff', '#1f6fc8'));
    x.beginPath(); x.moveTo(-30, 30); x.bezierCurveTo(-26, 0, -8, -24, 14, -28); x.lineWidth = 3.5; x.strokeStyle = '#d8eeff'; x.stroke();
    for (const [cx, cy] of [[30, -24], [38, -14], [22, -32]]) { circ(x, cx, cy, 3.4); fs(x, '#fff', 2); }
  } },
  { id: 'moon', name: 'Moon', col: '#f2b51d', draw(x) {
    x.save(); circ(x, -2, 0, 40); fs(x, grad(x, -40, 40, '#ffe27a', '#f0a81a'));
    x.globalCompositeOperation = 'destination-out'; circ(x, 18, -12, 33); x.fill(); x.globalCompositeOperation = 'source-over';
    circ(x, -2, 0, 40); x.clip(); circ(x, 18, -12, 33); x.lineWidth = 4.5; x.strokeStyle = INK; x.stroke(); x.restore();
    for (const [sx, sy, r] of [[30, 26, 5], [36, 4, 3.4]]) { x.save(); x.translate(sx, sy); poly(x, [[0, -r * 2], [r * 0.5, -r * 0.5], [r * 2, 0], [r * 0.5, r * 0.5], [0, r * 2], [-r * 0.5, r * 0.5], [-r * 2, 0], [-r * 0.5, -r * 0.5]]); fs(x, '#ffd84a', 2); x.restore(); }
  } },
  { id: 'butterfly', name: 'Butterfly', col: '#8e5cf0', draw(x) {
    for (const s of [-1, 1]) {
      x.save(); x.scale(s, 1);
      ell(x, 20, -14, 22, 18, -0.5); fs(x, grad(x, -32, 4, '#c3a2ff', '#7a46e8'));
      ell(x, 16, 16, 15, 13, 0.5); fs(x, grad(x, 4, 30, '#9fd3ff', '#4e8ef0'));
      circ(x, 22, -16, 6); fs(x, '#fff3a8', 2.5);
      x.restore();
    }
    ell(x, 0, 2, 5, 26); fs(x, '#4a2d22', 3);
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, -22); x.quadraticCurveTo(s * 8, -40, s * 14, -40); x.lineWidth = 3; x.strokeStyle = INK; x.stroke(); circ(x, s * 14, -40, 3); x.fillStyle = INK; x.fill(); }
  } },
  { id: 'lantern', name: 'Lantern', col: '#e8332a', draw(x) {
    x.beginPath(); x.moveTo(0, -46); x.lineTo(0, -38); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
    x.beginPath(); x.roundRect(-14, -40, 28, 8, 3); fs(x, '#f6c445', 3.5);
    ell(x, 0, 0, 33, 32); fs(x, rgrad(x, 0, 0, 36, '#ff7a5c', '#d42a20'));
    for (const k of [-0.55, 0, 0.55]) { ell(x, 0, 0, 33 * Math.abs(Math.cos(k * 1.6)) + 1, 32); x.lineWidth = 2.4; x.strokeStyle = 'rgba(80,10,0,.55)'; x.stroke(); }
    x.beginPath(); x.roundRect(-14, 30, 28, 8, 3); fs(x, '#f6c445', 3.5);
    for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 4, 38); x.lineTo(i * 4.8, 50); x.lineWidth = 3.4; x.strokeStyle = '#f0a81a'; x.stroke(); }
    shine(x, -14, -12, 6, 11, 0.4);
  } },
  { id: 'cloud', name: 'Cloud', col: '#7fb8ff', draw(x) {
    x.beginPath(); x.arc(-22, 8, 16, P * 0.5, P * 1.5); x.arc(-6, -10, 20, P, P * 1.9); x.arc(18, -4, 18, P * 1.25, P * 0.15); x.arc(24, 14, 12, P * 1.6, P * 0.5); x.lineTo(-22, 24); x.closePath();
    fs(x, grad(x, -30, 26, '#ffffff', '#cfe6ff'));
    x.beginPath(); x.moveTo(-10, 4); x.bezierCurveTo(-10, -6, 4, -6, 4, 4); x.bezierCurveTo(4, 10, -4, 10, -4, 4); x.lineWidth = 3.5; x.strokeStyle = '#5c9fe8'; x.stroke();
    x.beginPath(); x.moveTo(-40, 36); x.bezierCurveTo(-20, 30, 10, 40, 40, 32); x.lineWidth = 4; x.strokeStyle = '#7fb8ff'; x.stroke();
  } },
  { id: 'pine', name: 'Pine', col: '#1f7a4c', draw(x) {
    x.beginPath(); x.roundRect(-6, 26, 12, 20, 2); fs(x, '#8a5a34', 3.5);
    for (const [y, w] of [[30, 44], [8, 36], [-14, 26]]) { poly(x, [[0, y - 30], [w, y], [-w, y]]); fs(x, grad(x, y - 30, y, '#43b06d', '#16663c')); }
    circ(x, 0, -44, 4); fs(x, '#ffe27a', 2.5);
  } },
  { id: 'tea', name: 'Tea', col: '#5aa35a', draw(x) {
    for (const s of [-10, 4, 18]) { x.beginPath(); x.moveTo(s - 4, -18); x.bezierCurveTo(s + 6, -28, s - 10, -34, s, -46); x.lineWidth = 3.5; x.strokeStyle = '#b6c8d6'; x.stroke(); }
    ell(x, 0, 36, 40, 7); fs(x, '#f3efe6', 3.5);
    x.beginPath(); x.moveTo(-32, -12); x.lineTo(32, -12); x.bezierCurveTo(30, 18, 18, 32, 0, 32); x.bezierCurveTo(-18, 32, -30, 18, -32, -12); x.closePath(); fs(x, grad(x, -12, 32, '#7cc47c', '#3d8a45'));
    ell(x, 0, -12, 32, 6); fs(x, '#c6e08a', 3.5);
    x.beginPath(); x.moveTo(-26, 6); x.bezierCurveTo(-10, 12, 10, 12, 26, 6); x.lineWidth = 3; x.strokeStyle = '#f2e7c6'; x.stroke();
  } },
  { id: 'sakura', name: 'Blossom', col: '#ff8fb5', draw(x) {
    for (let i = 0; i < 5; i++) {
      x.save(); x.rotate(i * P * 2 / 5); x.beginPath(); x.moveTo(0, -6);
      x.bezierCurveTo(20, -14, 20, -38, 6, -44); x.lineTo(0, -38); x.lineTo(-6, -44); x.bezierCurveTo(-20, -38, -20, -14, 0, -6); fs(x, grad(x, -44, -6, '#ffd0e2', '#ff86b0')); x.restore();
    }
    circ(x, 0, 0, 10); fs(x, '#ffd84a', 3);
    for (let i = 0; i < 5; i++) { const a = i * P * 2 / 5 + P / 5; circ(x, Math.sin(a) * 16, -Math.cos(a) * 16, 2.6); x.fillStyle = '#d4456f'; x.fill(); }
  } },
  { id: 'frog', name: 'Frog', col: '#62c234', draw(x) {
    ell(x, 0, 12, 40, 28); fs(x, grad(x, -16, 40, '#8ee05a', '#3f9a2a'));
    for (const s of [-1, 1]) { circ(x, s * 18, -18, 14); fs(x, '#8ee05a'); circ(x, s * 18, -18, 8); fs(x, '#fff', 2.5); circ(x, s * 18, -17, 4); x.fillStyle = INK; x.fill(); }
    x.beginPath(); x.moveTo(-18, 16); x.quadraticCurveTo(0, 30, 18, 16); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
    for (const s of [-1, 1]) { circ(x, s * 26, 12, 4.5); x.fillStyle = '#ff9fae'; x.fill(); }
  } },
  { id: 'maple', name: 'Maple', col: '#f0602a', draw(x) {
    x.beginPath(); x.moveTo(0, 22); x.lineTo(4, 48); x.lineWidth = 5; x.strokeStyle = '#8a3a1a'; x.stroke();
    const pts = []; const R = [44, 18, 34, 16, 30, 26, 30, 16, 34, 18];
    for (let i = 0; i < 10; i++) { const a = -P / 2 + i * P / 5, r = R[i]; pts.push([Math.cos(a) * r, Math.sin(a) * r + 4]); }
    poly(x, pts); fs(x, grad(x, -40, 30, '#ff9a3c', '#d9381e'));
    x.beginPath(); for (const i of [0, 2, 8]) { x.moveTo(0, 6); x.lineTo(pts[i][0] * 0.7, pts[i][1] * 0.7); } x.lineWidth = 2.5; x.strokeStyle = '#a82a10'; x.stroke();
  } },
  { id: 'fuji', name: 'Mountain', col: '#4f7fd6', draw(x) {
    circ(x, 24, -24, 13); fs(x, '#ff6a4a', 3);
    poly(x, [[-46, 38], [-10, -26], [10, -26], [46, 38]]); fs(x, grad(x, -26, 38, '#7aa6f0', '#3b62c0'));
    poly(x, [[-10, -26], [10, -26], [20, -8], [10, -12], [2, -4], [-6, -12], [-20, -8]]); fs(x, '#ffffff', 3.5);
    x.beginPath(); x.moveTo(-46, 38); x.lineTo(46, 38); x.lineWidth = 4.5; x.strokeStyle = INK; x.stroke();
  } },
  { id: 'fan', name: 'Fan', col: '#b15ad6', draw(x) {
    x.beginPath(); x.moveTo(0, 34); x.arc(0, 34, 66, P * 1.18, P * 1.82); x.closePath(); fs(x, grad(x, -32, 34, '#e7a0ff', '#9a3fd0'));
    x.beginPath(); x.arc(0, 34, 30, P * 1.18, P * 1.82); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
    for (let i = 0; i <= 6; i++) { const a = P * 1.18 + i * P * 0.64 / 6; x.beginPath(); x.moveTo(0, 34); x.lineTo(Math.cos(a) * 66, 34 + Math.sin(a) * 66); x.lineWidth = 2; x.strokeStyle = 'rgba(58,36,24,.6)'; x.stroke(); }
    circ(x, 0, 34, 5); fs(x, '#f6c445', 3);
    circ(x, 0, -10, 9); fs(x, '#ff5d73', 2.5);
  } },
  { id: 'sun', name: 'Sun', col: '#ff4a2a', draw(x) {
    for (let i = 0; i < 12; i++) { x.save(); x.rotate(i * P / 6); poly(x, [[-6, -28], [0, -46], [6, -28]]); fs(x, '#ffb02e', 3); x.restore(); }
    circ(x, 0, 0, 27); fs(x, rgrad(x, 0, 0, 30, '#ff8a5a', '#e8261a'));
    shine(x, -9, -10, 6, 9);
  } },
  { id: 'turtle', name: 'Turtle', col: '#2f9e7a', draw(x) {
    for (const [lx, ly] of [[-26, -18], [26, -18], [-26, 22], [26, 22]]) { ell(x, lx, ly, 9, 7); fs(x, '#8fd36a', 3); }
    ell(x, 0, -38, 10, 11); fs(x, '#8fd36a', 3.5); circ(x, -4, -40, 2.2); circ(x, 4, -40, 2.2); x.fillStyle = INK; x.fill();
    ell(x, 0, 2, 30, 34); fs(x, grad(x, -30, 36, '#53c49a', '#1f7a5a'));
    poly(x, [[0, -14], [12, -6], [12, 8], [0, 16], [-12, 8], [-12, -6]]); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
    for (const [a, b, c, d] of [[0, -14, 0, -32], [12, -6, 26, -14], [-12, -6, -26, -14], [12, 8, 26, 16], [-12, 8, -26, 16], [0, 16, 0, 34]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
  } },
  { id: 'bell', name: 'Bell', col: '#e0a51a', draw(x) {
    x.beginPath(); x.arc(0, -36, 7, 0, P * 2); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
    x.beginPath(); x.moveTo(-30, 28); x.bezierCurveTo(-30, -2, -26, -30, 0, -30); x.bezierCurveTo(26, -30, 30, -2, 30, 28); x.lineTo(36, 34); x.lineTo(-36, 34); x.closePath(); fs(x, grad(x, -30, 34, '#ffe27a', '#d9900e'));
    circ(x, 0, 40, 7); fs(x, '#c97a10', 3.5);
    x.beginPath(); x.moveTo(-26, 16); x.lineTo(26, 16); x.lineWidth = 3; x.strokeStyle = '#a86a10'; x.stroke();
    shine(x, -12, -10, 5, 12, 0.2);
  } },
  { id: 'mushroom', name: 'Mushroom', col: '#e2362e', draw(x) {
    x.beginPath(); x.moveTo(-14, 4); x.bezierCurveTo(-16, 30, -18, 40, -16, 44); x.lineTo(16, 44); x.bezierCurveTo(18, 40, 16, 30, 14, 4); x.closePath(); fs(x, '#fff3df');
    x.beginPath(); x.moveTo(-44, 10); x.bezierCurveTo(-44, -40, 44, -40, 44, 10); x.bezierCurveTo(20, 2, -20, 2, -44, 10); x.closePath(); fs(x, grad(x, -36, 10, '#ff6a5a', '#c8221a'));
    for (const [cx, cy, r] of [[-20, -8, 6], [4, -20, 7], [24, -6, 5], [-2, -2, 4]]) { circ(x, cx, cy, r); fs(x, '#fff', 2.5); }
  } },
  { id: 'pagoda', name: 'Pagoda', col: '#d23a2a', draw(x) {
    x.beginPath(); x.moveTo(0, -48); x.lineTo(0, -36); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
    for (const [y, w, h] of [[-26, 22, 12], [-2, 30, 14], [24, 38, 16]]) {
      x.beginPath(); x.rect(-w * 0.55, y, w * 1.1, h); fs(x, '#ffe3b0', 3.5);
      x.beginPath(); x.moveTo(-w - 8, y + 2); x.quadraticCurveTo(-w * 0.4, y - 4, 0, y - 12); x.quadraticCurveTo(w * 0.4, y - 4, w + 8, y + 2); x.lineTo(w * 0.7, y); x.lineTo(-w * 0.7, y); x.closePath(); fs(x, '#d23a2a', 3.5);
    }
    x.beginPath(); x.rect(-46, 40, 92, 6); fs(x, '#8a6a4a', 3.5);
  } },
  { id: 'torii', name: 'Gate', col: '#ee4a24', draw(x) {
    x.beginPath(); x.moveTo(-48, -30); x.quadraticCurveTo(0, -42, 48, -30); x.lineTo(46, -22); x.quadraticCurveTo(0, -32, -46, -22); x.closePath(); fs(x, '#ee4a24');
    x.beginPath(); x.rect(-40, -12, 80, 8); fs(x, '#ee4a24', 3.5);
    for (const s of [-1, 1]) { x.beginPath(); x.rect(s * 28 - 5, -24, 10, 66); fs(x, '#ee4a24', 3.5); x.beginPath(); x.rect(s * 28 - 7, 36, 14, 8); fs(x, '#3a2418', 0); }
    x.beginPath(); x.rect(-5, -12, 10, 8); x.fillStyle = '#ffd34a'; x.fill();
  } },
  { id: 'umbrella', name: 'Parasol', col: '#ff5d8f', draw(x) {
    x.beginPath(); x.moveTo(0, -20); x.lineTo(0, 40); x.quadraticCurveTo(0, 48, -8, 46); x.lineWidth = 4.5; x.strokeStyle = '#8a5a34'; x.stroke();
    x.beginPath(); x.moveTo(-46, 0); x.quadraticCurveTo(-40, -40, 0, -42); x.quadraticCurveTo(40, -40, 46, 0);
    for (let i = 4; i >= -4; i -= 2) x.quadraticCurveTo(i * 11.5 + 5.75, -8, i * 11.5 - (i > -4 ? 11.5 - 11.5 : 0), 0);
    x.closePath(); fs(x, grad(x, -42, 0, '#ffa0c0', '#ff4f86'));
    for (const k of [-0.5, 0, 0.5]) { x.beginPath(); x.moveTo(0, -42); x.quadraticCurveTo(k * 40, -24, k * 70 * 0.66, 0); x.lineWidth = 2.5; x.strokeStyle = 'rgba(58,36,24,.55)'; x.stroke(); }
  } },
  { id: 'onigiri', name: 'Rice ball', col: '#3a3a3a', draw(x) {
    x.beginPath(); x.moveTo(0, -42); x.bezierCurveTo(12, -42, 44, 18, 40, 30); x.bezierCurveTo(36, 40, -36, 40, -40, 30); x.bezierCurveTo(-44, 18, -12, -42, 0, -42); fs(x, grad(x, -42, 40, '#ffffff', '#e8e2d6'));
    x.beginPath(); x.rect(-16, 8, 32, 31); fs(x, '#25402e', 3.5);
    for (const [cx, cy] of [[-14, -6], [10, -16], [18, 2], [-4, -24]]) { ell(x, cx, cy, 3, 2); x.fillStyle = '#c9bfae'; x.fill(); }
  } },
  { id: 'cherries', name: 'Cherries', col: '#d0182e', draw(x) {
    x.beginPath(); x.moveTo(-16, 10); x.quadraticCurveTo(-8, -26, 8, -40); x.moveTo(18, 14); x.quadraticCurveTo(14, -20, 8, -40); x.lineWidth = 4; x.strokeStyle = '#4b8a2a'; x.stroke();
    x.save(); x.translate(14, -38); x.rotate(-0.5); ell(x, 12, 0, 13, 6); fs(x, '#62c234', 3); x.restore();
    circ(x, -18, 22, 18); fs(x, rgrad(x, -18, 22, 20, '#ff5a6a', '#b80e22')); circ(x, 20, 24, 17); fs(x, rgrad(x, 20, 24, 19, '#ff5a6a', '#b80e22'));
    shine(x, -24, 16, 4, 6); shine(x, 14, 18, 4, 6);
  } },
  { id: 'star', name: 'Star', col: '#ffc21a', draw(x) {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -P / 2 + i * P / 5, r = i % 2 ? 20 : 46; pts.push([Math.cos(a) * r, Math.sin(a) * r + 3]); }
    x.lineJoin = 'round'; poly(x, pts); fs(x, grad(x, -44, 44, '#ffe35a', '#f5a00a'), 5);
    shine(x, -8, -12, 5, 9, 0.5);
  } },
  { id: 'crane', name: 'Crane', col: '#9aa3b5', draw(x) {
    poly(x, [[-6, 4], [-46, -30], [-20, 10]]); fs(x, '#ffffff');
    poly(x, [[6, 4], [40, -38], [22, 12]]); fs(x, '#f0f2f8');
    ell(x, 0, 10, 26, 13, -0.15); fs(x, '#ffffff');
    poly(x, [[-22, 14], [-44, 26], [-24, 20]]); fs(x, '#2a2a2a', 3);
    x.beginPath(); x.moveTo(20, 4); x.quadraticCurveTo(30, -10, 26, -26); x.lineWidth = 6; x.strokeStyle = INK; x.stroke(); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
    circ(x, 27, -28, 6); fs(x, '#fff', 3); circ(x, 27, -31, 3.5); x.fillStyle = '#e8261a'; x.fill();
    poly(x, [[32, -28], [46, -24], [32, -24]]); fs(x, '#f0b030', 2.5);
    for (const lx of [-4, 6]) { x.beginPath(); x.moveTo(lx, 22); x.lineTo(lx - 2, 44); x.lineWidth = 3; x.strokeStyle = INK; x.stroke(); }
  } },
  { id: 'heart', name: 'Heart', col: '#f0305a', draw(x) {
    x.beginPath(); x.moveTo(0, 40); x.bezierCurveTo(-60, 0, -36, -50, 0, -20); x.bezierCurveTo(36, -50, 60, 0, 0, 40); fs(x, rgrad(x, 0, 0, 44, '#ff7a9a', '#d8183e'), 5);
    shine(x, -18, -14, 6, 10, 0.6);
  } },
  { id: 'snow', name: 'Snowflake', col: '#3fa8e8', draw(x) {
    x.lineCap = 'round';
    for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * P / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -44); x.moveTo(0, -26); x.lineTo(-12, -36); x.moveTo(0, -26); x.lineTo(12, -36); x.moveTo(0, -12); x.lineTo(-9, -20); x.moveTo(0, -12); x.lineTo(9, -20);
      x.lineWidth = 10; x.strokeStyle = INK; x.stroke(); x.lineWidth = 5.5; x.strokeStyle = '#6cc4ff'; x.stroke(); x.restore(); }
    circ(x, 0, 0, 7); fs(x, '#e6f6ff', 3);
  } },
  { id: 'acorn', name: 'Acorn', col: '#a8642a', draw(x) {
    x.beginPath(); x.moveTo(-26, -6); x.bezierCurveTo(-28, 26, -8, 44, 0, 46); x.bezierCurveTo(8, 44, 28, 26, 26, -6); x.closePath(); fs(x, grad(x, -6, 46, '#e0a060', '#a8642a'));
    x.beginPath(); x.moveTo(-32, -4); x.bezierCurveTo(-34, -30, 34, -30, 32, -4); x.closePath(); fs(x, '#6a4224');
    for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 12 - 6, -6); x.lineTo(i * 12 + 6, -22); x.lineWidth = 2; x.strokeStyle = 'rgba(255,220,170,.5)'; x.stroke(); }
    x.beginPath(); x.moveTo(0, -24); x.quadraticCurveTo(2, -36, 10, -40); x.lineWidth = 5; x.strokeStyle = INK; x.stroke();
    shine(x, -12, 12, 4, 9, 0.1);
  } },
  { id: 'shell', name: 'Shell', col: '#ff9a7a', draw(x) {
    x.beginPath(); x.moveTo(-10, 34); x.lineTo(-44, -2); x.bezierCurveTo(-40, -40, 40, -40, 44, -2); x.lineTo(10, 34); x.closePath(); fs(x, grad(x, -36, 34, '#ffd0b8', '#ff8a6a'));
    for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(0, 32); x.lineTo(i * 12, -30 + Math.abs(i) * 6); x.lineWidth = 2.6; x.strokeStyle = 'rgba(160,60,40,.65)'; x.stroke(); }
    x.beginPath(); x.rect(-16, 32, 32, 10); fs(x, '#ffb89a', 3.5);
  } },
  { id: 'boat', name: 'Paper boat', col: '#3a7ad8', draw(x) {
    poly(x, [[-46, 4], [46, 4], [30, 30], [-30, 30]]); fs(x, grad(x, 4, 30, '#6aa8ff', '#2f66c8'));
    poly(x, [[-2, -44], [-2, 4], [-34, 4]]); fs(x, '#ffffff');
    poly(x, [[4, -30], [4, 4], [30, 4]]); fs(x, '#ffe27a');
    x.beginPath(); x.moveTo(-46, 40); x.quadraticCurveTo(-30, 34, -14, 40); x.quadraticCurveTo(2, 46, 18, 40); x.quadraticCurveTo(32, 34, 46, 40); x.lineWidth = 4; x.strokeStyle = '#4fa8e8'; x.stroke();
  } },
  { id: 'kite', name: 'Kite', col: '#f04a6a', draw(x) {
    x.beginPath(); x.moveTo(0, 30); x.bezierCurveTo(-10, 38, 10, 42, 0, 50); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
    for (const [bx, by] of [[-4, 40], [4, 47]]) { poly(x, [[bx - 6, by - 4], [bx + 6, by + 4], [bx + 6, by - 4], [bx - 6, by + 4]]); fs(x, '#ffd34a', 2); }
    poly(x, [[0, -46], [32, -6], [0, 30], [-32, -6]]); fs(x, '#f04a6a');
    x.save(); poly(x, [[0, -46], [32, -6], [0, 30], [-32, -6]]); x.clip(); poly(x, [[0, -46], [32, -6], [0, -6]]); x.fillStyle = '#ffd34a'; x.fill(); poly(x, [[0, 30], [-32, -6], [0, -6]]); x.fillStyle = '#ffd34a'; x.fill(); x.restore();
    poly(x, [[0, -46], [32, -6], [0, 30], [-32, -6]]); x.lineWidth = 4.5; x.strokeStyle = INK; x.stroke();
    x.beginPath(); x.moveTo(0, -46); x.lineTo(0, 30); x.moveTo(-32, -6); x.lineTo(32, -6); x.lineWidth = 2.5; x.stroke();
  } },
  { id: 'dragonfly', name: 'Dragonfly', col: '#1fb5b0', draw(x) {
    for (const [s, y, a] of [[-1, -12, -0.25], [1, -12, 0.25], [-1, 2, 0.2], [1, 2, -0.2]]) { ell(x, s * 24, y, 22, 7, a * s * -1); x.globalAlpha = 1; fs(x, 'rgba(170,240,240,.95)', 3); }
    x.beginPath(); x.roundRect(-4, -14, 8, 58, 4); fs(x, grad(x, -14, 44, '#3fd6c8', '#178a86'), 3.5);
    circ(x, 0, -22, 9); fs(x, '#3fd6c8', 3.5); circ(x, -4, -24, 3); circ(x, 4, -24, 3); x.fillStyle = INK; x.fill();
  } },
  { id: 'ginkgo', name: 'Ginkgo', col: '#e8b81a', draw(x) {
    x.beginPath(); x.moveTo(0, 14); x.lineTo(-2, 46); x.lineWidth = 5; x.strokeStyle = '#8a6a2a'; x.stroke();
    x.beginPath(); x.moveTo(0, 16); x.lineTo(-44, -20); x.quadraticCurveTo(-30, -44, -4, -38); x.lineTo(0, -20); x.lineTo(4, -38); x.quadraticCurveTo(30, -44, 44, -20); x.closePath(); fs(x, grad(x, -44, 16, '#ffe35a', '#e0a010'));
    for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(0, 14); x.lineTo(i * 11, -30); x.lineWidth = 1.8; x.strokeStyle = 'rgba(140,90,10,.6)'; x.stroke(); }
  } },
  { id: 'drum', name: 'Drum', col: '#b06a3a', draw(x) {
    x.beginPath(); x.moveTo(-34, -20); x.bezierCurveTo(-42, 0, -42, 10, -34, 30); x.lineTo(34, 30); x.bezierCurveTo(42, 10, 42, 0, 34, -20); x.closePath(); fs(x, grad(x, -20, 30, '#d88a4a', '#9a5428'));
    ell(x, 0, -20, 34, 10); fs(x, '#fff1d8');
    x.beginPath(); x.arc(0, -20, 6, 0, P * 2); x.fillStyle = '#e8261a'; x.fill();
    for (let i = -2; i <= 2; i++) { circ(x, i * 13, 2, 2.6); x.fillStyle = '#ffd34a'; x.fill(); }
    for (const s of [-1, 1]) { x.save(); x.translate(s * 22, -40); x.rotate(s * 0.7); x.beginPath(); x.roundRect(-3, -14, 6, 30, 3); fs(x, '#f3d29a', 3); x.restore(); }
  } },
  { id: 'bonsai', name: 'Bonsai', col: '#2e8a4a', draw(x) {
    x.beginPath(); x.moveTo(-36, 24); x.lineTo(36, 24); x.lineTo(28, 42); x.lineTo(-28, 42); x.closePath(); fs(x, '#3f7ad0');
    x.beginPath(); x.moveTo(-4, 24); x.bezierCurveTo(-14, 6, 12, 0, 0, -12); x.lineWidth = 9; x.strokeStyle = INK; x.stroke(); x.lineWidth = 5; x.strokeStyle = '#8a5a34'; x.stroke();
    for (const [cx, cy, rx] of [[-20, -10, 18], [16, -20, 20], [-4, -34, 16]]) { ell(x, cx, cy, rx, rx * 0.6); fs(x, grad(x, cy - 12, cy + 12, '#6fd07a', '#2a8a44')); }
  } },
  // treasure (index 36): a golden koi coin
  { id: 'gold', name: 'Golden koi', col: '#f2b51d', gold: true, draw(x) {
    circ(x, 0, 0, 44); fs(x, rgrad(x, 0, 0, 46, '#fff2a0', '#e09a10'), 5);
    circ(x, 0, 0, 34); x.lineWidth = 3; x.strokeStyle = '#b8780a'; x.stroke();
    x.save(); x.scale(0.62, 0.62); x.translate(4, 0);
    poly(x, [[22, 0], [44, -20], [38, 0], [44, 20]]); fs(x, '#ffd34a', 5);
    ell(x, -4, 0, 32, 19); fs(x, '#ffe27a', 5); circ(x, -22, -4, 4); x.fillStyle = INK; x.fill();
    x.restore();
    for (const [sx, sy] of [[-30, -30], [32, -26], [28, 32]]) { x.save(); x.translate(sx, sy); poly(x, [[0, -9], [2, -2], [9, 0], [2, 2], [0, 9], [-2, 2], [-9, 0], [-2, -2]]); x.fillStyle = '#fff'; x.fill(); x.restore(); }
  } },
];
export const KINDS = 36;  // non-treasure symbols

// draws the atlas; returns { map, bump } canvases. faceBg = the ivory face with a carved frame.
export function drawAtlas() {
  const W = COLS * CW, H = ROWS * CH;
  const map = document.createElement('canvas'); map.width = W; map.height = H;
  const bump = document.createElement('canvas'); bump.width = W; bump.height = H;
  const m = map.getContext('2d'), b = bump.getContext('2d');
  b.fillStyle = '#fff'; b.fillRect(0, 0, W, H);
  const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH; const t = tmp.getContext('2d');
  SYMBOLS.forEach((S, i) => {
    const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
    // ivory face + soft gradient + carved frame
    const g = m.createLinearGradient(0, oy, 0, oy + CH); g.addColorStop(0, S.gold ? '#fff3c4' : '#fffaf0'); g.addColorStop(1, S.gold ? '#f7d97a' : '#f3e8d2');
    m.fillStyle = g; m.fillRect(ox, oy, CW, CH);
    m.save(); m.beginPath(); m.roundRect(ox + 14, oy + 14, CW - 28, CH - 28, 22); m.lineWidth = 4; m.strokeStyle = S.gold ? 'rgba(190,120,10,.55)' : 'rgba(150,120,80,.28)'; m.stroke(); m.restore();
    b.save(); b.beginPath(); b.roundRect(ox + 14, oy + 14, CW - 28, CH - 28, 22); b.lineWidth = 5; b.strokeStyle = '#b0b0b0'; b.stroke(); b.restore();
    // symbol on a temp canvas
    t.clearRect(0, 0, CW, CH); t.save(); t.translate(CW / 2, CH / 2); t.scale(2.3, 2.3); t.lineJoin = 'round'; t.lineCap = 'round'; S.draw(t); t.restore();
    // soft drop shadow under the symbol (carved depth), then the symbol
    m.save(); m.shadowColor = 'rgba(80,50,20,.35)'; m.shadowBlur = 6; m.shadowOffsetY = 4; m.drawImage(tmp, ox, oy); m.restore();
    // bump: silhouette of the symbol pushed down (engraved)
    t.globalCompositeOperation = 'source-in'; t.fillStyle = '#5a5a5a'; t.fillRect(0, 0, CW, CH); t.globalCompositeOperation = 'source-over';
    b.drawImage(tmp, ox, oy);
  });
  return { map, bump };
}

// small icon of a symbol for the HTML UI (data URL)
const iconCache = {};
export function symbolIcon(i, size = 96) {
  if (iconCache[i + ':' + size]) return iconCache[i + ':' + size];
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  x.translate(size / 2, size / 2); x.scale(size / 110, size / 110); x.lineJoin = 'round'; x.lineCap = 'round'; SYMBOLS[i].draw(x);
  return iconCache[i + ':' + size] = c.toDataURL();
}

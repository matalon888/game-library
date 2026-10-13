/* LIGHTCONE · particle system — cosmetic sparks, mist, debris and dust.
   Positions/velocities in tile units; drawn additively onto the light layer
   so every particle glows and feeds the bloom pass. */
(function () {
  window.HS = window.HS || {};

  const MAX = 900;
  const P = [];

  function spawn(o) {
    if (P.length >= MAX) P.shift();
    P.push(Object.assign({
      age: 0, life: 0.5, size: 5, alpha: 0.7,
      vx: 0, vy: 0, drag: 0, rot: 0, spin: 0,
      color: [255, 255, 255], shape: 'dot',
    }, o));
  }

  function update(dt) {
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
  }

  function draw(lctx, TILE, getSprite) {
    for (const p of P) {
      const k = 1 - p.age / p.life;
      const a = p.alpha * k;
      if (a <= 0.01) continue;
      const px = p.x * TILE, py = p.y * TILE;
      if (p.shape === 'dot') {
        const spr = getSprite(p.color[0], p.color[1], p.color[2]);
        const s = p.size * (0.55 + 0.45 * k) * 2;
        lctx.globalAlpha = a;
        lctx.drawImage(spr, px - s / 2, py - s / 2, s, s);
      } else if (p.shape === 'streak') {
        lctx.globalAlpha = 1;
        lctx.strokeStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${a})`;
        lctx.lineWidth = 1.6;
        lctx.beginPath();
        lctx.moveTo(px, py);
        lctx.lineTo(px - p.vx * 0.07 * TILE, py - p.vy * 0.07 * TILE);
        lctx.stroke();
      } else if (p.shape === 'shard') {
        lctx.globalAlpha = 1;
        const s = p.size * (0.4 + 0.6 * k);
        lctx.save();
        lctx.translate(px, py);
        lctx.rotate(p.rot);
        lctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${a})`;
        lctx.beginPath();
        lctx.moveTo(s, 0);
        lctx.lineTo(-s * 0.6, s * 0.45);
        lctx.lineTo(-s * 0.6, -s * 0.45);
        lctx.closePath();
        lctx.fill();
        lctx.restore();
      }
    }
    lctx.globalAlpha = 1;
  }

  HS.particles = { spawn, update, draw, count: () => P.length };
})();

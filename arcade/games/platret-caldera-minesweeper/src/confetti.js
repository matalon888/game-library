/* ============================================================
   confetti.js — one-shot gentle win burst on a canvas.
   No-ops under reduced motion / animations off.
   ============================================================ */

export function burst(canvas, { colors, reduced } = {}) {
  if (reduced) return;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const palette = colors && colors.length ? colors : ["#FF7A1A", "#FFB066", "#2FBF8F", "#5B8CFF"];
  const N = Math.min(160, Math.floor((W * H) / 900));
  const parts = [];
  const cx = W / 2, cy = H / 2;
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N + Math.random() * 0.5;
    const speed = 2 + Math.random() * 6;
    parts.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: palette[i % palette.length],
      life: 1,
    });
  }

  // cancel any in-flight burst on this canvas so rapid wins don't stack loops
  if (canvas._confettiRaf) cancelAnimationFrame(canvas._confettiRaf);
  const gravity = 0.16;
  const drag = 0.99;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.vy += gravity;
      p.vx *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.008;
      if (p.life <= 0 || p.y > H + 20) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (alive) canvas._confettiRaf = requestAnimationFrame(frame);
    else { canvas._confettiRaf = 0; ctx.clearRect(0, 0, W, H); }
  }
  frame();
}

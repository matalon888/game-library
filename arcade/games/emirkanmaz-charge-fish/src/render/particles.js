// Particle system. Two emitters: splash (water droplets) and sparkle (catch).
// Gravity is active for splash, dampened for sparkle.

const items = [];
const GRAVITY = 800; // px/s^2

class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.gravity = gravity;
  }

  update(dtSec) {
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.vy += this.gravity * dtSec;
    this.life -= dtSec;
  }
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export function emitSplash(x, y) {
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI / 2 + rand(-Math.PI * 0.4, Math.PI * 0.4);
    const sp = rand(150, 320);
    items.push(
      new Particle(
        x,
        y,
        Math.cos(ang) * sp,
        Math.sin(ang) * sp,
        rand(0.5, 0.85),
        'rgba(180, 220, 240, 0.95)',
        rand(3, 5),
        GRAVITY,
      ),
    );
  }
}

export function emitSparkle(x, y, opts = {}) {
  const count = opts.count ?? 20;
  const color = opts.color ?? '#f4d03f';
  const speed = opts.speed ?? 140;
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2);
    const sp = rand(speed * 0.4, speed);
    items.push(
      new Particle(
        x,
        y,
        Math.cos(ang) * sp,
        Math.sin(ang) * sp,
        rand(0.6, 1.1),
        color,
        rand(2, 4),
        GRAVITY * 0.15,
      ),
    );
  }
}

export const particleSystem = {
  update({ dtMs }) {
    const dtSec = dtMs / 1000;
    for (let i = items.length - 1; i >= 0; i--) {
      items[i].update(dtSec);
      if (items[i].life <= 0) items.splice(i, 1);
    }
  },

  draw({ ctx }) {
    for (const p of items) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

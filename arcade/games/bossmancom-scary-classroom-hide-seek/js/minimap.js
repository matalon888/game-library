/**
 * Top-down 2D minimap of classroom + long hallway.
 */
export class Minimap {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.w = canvas.width;
    this.h = canvas.height;
  }

  /** World XZ → canvas pixels */
  _project(x, z, bounds) {
    const pad = 8;
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxZ - bounds.minZ;
    // Fit classroom+hall in portrait-ish map (Z is long)
    const scale = Math.min(
      (this.w - pad * 2) / bw,
      (this.h - pad * 2) / bh
    );
    const ox = (this.w - bw * scale) / 2;
    const oy = (this.h - bh * scale) / 2;
    return {
      x: ox + (x - bounds.minX) * scale,
      y: oy + (z - bounds.minZ) * scale,
      scale,
    };
  }

  draw(player, seeker, seeking) {
    const ctx = this.ctx;
    const b = this.world.mapBounds || {
      minX: -10,
      maxX: 10,
      minZ: -8,
      maxZ: 40,
    };

    ctx.clearRect(0, 0, this.w, this.h);

    // Background
    ctx.fillStyle = 'rgba(8, 10, 12, 0.82)';
    ctx.strokeStyle = 'rgba(120, 115, 100, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, 1, 1, this.w - 2, this.h - 2, 6);
    ctx.fill();
    ctx.stroke();

    // Classroom floor
    const c0 = this._project(-10, -8, b);
    const c1 = this._project(10, 8, b);
    ctx.fillStyle = 'rgba(55, 58, 52, 0.9)';
    ctx.fillRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);

    // Hallway floor
    const h0 = this._project(-2.7, 8, b);
    const h1 = this._project(2.7, b.maxZ, b);
    ctx.fillStyle = 'rgba(48, 50, 46, 0.95)';
    ctx.fillRect(h0.x, h0.y, h1.x - h0.x, h1.y - h0.y);

    // Doorway notch
    ctx.fillStyle = 'rgba(48, 50, 46, 0.95)';
    const d0 = this._project(-1.5, 7.5, b);
    const d1 = this._project(1.5, 8.5, b);
    ctx.fillRect(d0.x, d0.y, d1.x - d0.x, d1.y - d0.y);

    // Desk dots (simple grid)
    ctx.fillStyle = 'rgba(90, 70, 50, 0.7)';
    for (const x of [-6, -2, 2, 6]) {
      for (const z of [-4.5, -1.5, 1.5]) {
        const p = this._project(x, z, b);
        ctx.fillRect(p.x - 2, p.y - 1.5, 4, 3);
      }
    }

    // Lockers as tiny ticks along hall
    ctx.fillStyle = 'rgba(90, 100, 110, 0.85)';
    const end = this.world.hallEndZ || 40;
    for (let z = 9.5; z <= end - 1.5; z += 2.9) {
      let p = this._project(-2.55, z, b);
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      p = this._project(2.55, z, b);
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    // Seeker
    if (seeking && seeker && seeker.mesh?.visible) {
      const s = this._project(seeker.position.x, seeker.position.z, b);
      ctx.fillStyle = '#c42a2a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick
      ctx.strokeStyle = 'rgba(255, 80, 60, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(
        s.x - Math.sin(seeker.yaw) * 10,
        s.y - Math.cos(seeker.yaw) * 10
      );
      ctx.stroke();
    }

    // Player
    const p = this._project(player.position.x, player.position.z, b);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = player.insideSpot
      ? '#6dce6a'
      : player.isSneaking
        ? '#7ab8d4'
        : '#e8e0c8';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Label
    ctx.fillStyle = 'rgba(180, 175, 160, 0.55)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText('MAP', 8, 14);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

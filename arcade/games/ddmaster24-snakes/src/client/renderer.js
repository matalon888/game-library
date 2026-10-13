// Renders authoritative snapshots with interpolation. Browser-only.
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.followId = null;
    this.cam = { x: 0, y: 0 };
    this.zoom = 1;
    this.camSmooth = 0.15;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setFollowId(id) {
    this.followId = id;
    // Reset the camera so render() snaps to the new head instead of sliding
    // across the map on (re)spawn — the Renderer is reused across games.
    this.cam = { x: 0, y: 0 };
  }

  _lerp(a, b, t) { return a + (b - a) * t; }

  _interpSnakes(prev, last, alpha) {
    const prevById = new Map();
    if (prev) for (const s of prev.snakes) prevById.set(s.id, s);
    return last.snakes.map((s) => {
      const p = prevById.get(s.id);
      if (!p) return s;
      const n = Math.min(s.segments.length, p.segments.length);
      const segments = s.segments.map((seg, i) => {
        if (i < n) {
          return { x: this._lerp(p.segments[i].x, seg.x, alpha),
                   y: this._lerp(p.segments[i].y, seg.y, alpha) };
        }
        return seg;
      });
      const da = ((s.angle - p.angle + Math.PI) % (Math.PI * 2)) - Math.PI;
      const angle = p.angle + da * alpha;
      return { ...s, segments, angle };
    });
  }

  worldToScreen(x, y) {
    return { x: (x - this.cam.x) * this.zoom, y: (y - this.cam.y) * this.zoom };
  }

  render(prev, last, alpha) {
    if (!last) return;
    const snakes = this._interpSnakes(prev, last, alpha);

    // Camera follows our snake's head.
    const me = snakes.find((s) => s.id === this.followId) || snakes[0];
    if (me) {
      // Zoom out gently as we grow so big snakes aren't claustrophobic.
      const targetZoom = Math.max(0.55, Math.min(1, 14 / (me.radius || 10)));
      this.zoom += (targetZoom - this.zoom) * 0.05;
      const head = me.segments[0];
      const targetX = head.x - this.canvas.width / (2 * this.zoom);
      const targetY = head.y - this.canvas.height / (2 * this.zoom);
      if (this.cam.x === 0 && this.cam.y === 0) {
        this.cam.x = targetX; this.cam.y = targetY;
      } else {
        this.cam.x += (targetX - this.cam.x) * this.camSmooth;
        this.cam.y += (targetY - this.cam.y) * this.camSmooth;
      }
    }

    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawGrid();
    for (const p of last.particles) this._drawParticle(p);
    for (const s of snakes) this._drawSnake(s);
    this._drawBorders();
    const meBoost = me && me.boosting;
    if (meBoost) { ctx.fillStyle = 'rgba(255,255,0,0.3)'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
    this._drawMinimap(snakes, me);
  }

  _drawMinimap(snakes, me) {
    const ctx = this.ctx;
    const W = 4000;
    const size = 160;
    const margin = 16;
    const x0 = this.canvas.width - size - margin;
    const y0 = this.canvas.height - size - margin;
    const scale = size / W;

    // Panel
    ctx.fillStyle = 'rgba(10, 10, 21, 0.6)';
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, size, size);

    // Snakes as dots
    for (const s of snakes) {
      const h = s.segments[0];
      const mx = x0 + h.x * scale;
      const my = y0 + h.y * scale;
      const isMe = me && s.id === me.id;
      ctx.fillStyle = isMe ? '#ffffff' : (s.color || '#888');
      ctx.beginPath();
      ctx.arc(mx, my, isMe ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawGrid() {
    const ctx = this.ctx;
    const grid = 100;
    const startX = Math.floor(this.cam.x / grid) * grid;
    const startY = Math.floor(this.cam.y / grid) * grid;
    const endX = this.cam.x + this.canvas.width / this.zoom;
    const endY = this.cam.y + this.canvas.height / this.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = startX; x < endX; x += grid) {
      const sp = this.worldToScreen(x, 0);
      ctx.beginPath(); ctx.moveTo(sp.x, 0); ctx.lineTo(sp.x, this.canvas.height); ctx.stroke();
    }
    for (let y = startY; y < endY; y += grid) {
      const sp = this.worldToScreen(0, y);
      ctx.beginPath(); ctx.moveTo(0, sp.y); ctx.lineTo(this.canvas.width, sp.y); ctx.stroke();
    }
  }

  _drawParticle(p) {
    const ctx = this.ctx;
    const sp = this.worldToScreen(p.x, p.y);
    if (sp.x < -50 || sp.x > this.canvas.width + 50 || sp.y < -50 || sp.y > this.canvas.height + 50) return;
    const glow = p.r + 6;
    const g = ctx.createRadialGradient(sp.x, sp.y, p.r, sp.x, sp.y, glow);
    g.addColorStop(0, p.color); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, glow, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, p.r, 0, Math.PI * 2); ctx.fill();
  }

  _drawSnake(s) {
    const ctx = this.ctx;
    const radius = s.radius;
    const glowMul = s.boosting ? 2.4 : 2;
    for (let i = s.segments.length - 1; i >= 0; i--) {
      const sp = this.worldToScreen(s.segments[i].x, s.segments[i].y);
      if (sp.x < -radius * 3 || sp.x > this.canvas.width + radius * 3 ||
          sp.y < -radius * 3 || sp.y > this.canvas.height + radius * 3) continue;
      const g = ctx.createRadialGradient(sp.x, sp.y, radius * 0.5, sp.x, sp.y, radius * glowMul);
      g.addColorStop(0, s.color); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, radius * glowMul, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(sp.x - radius * 0.3, sp.y - radius * 0.3, radius * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // Eyes
    const hs = this.worldToScreen(s.segments[0].x, s.segments[0].y);
    const eyeDist = radius * 0.5, eyeSize = radius * 0.3;
    for (const side of [-1, 1]) {
      const ex = hs.x + Math.cos(s.angle + side * 0.5) * eyeDist;
      const ey = hs.y + Math.sin(s.angle + side * 0.5) * eyeDist;
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(ex, ey, eyeSize * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    if (s.boosting) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(hs.x, hs.y, radius * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Name tag for everyone (helps tell players apart)
    ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
    ctx.fillText(s.name, hs.x, hs.y - radius - 15);
    ctx.textAlign = 'left';
  }

  _drawBorders() {
    const ctx = this.ctx;
    const W = 4000;
    const corners = [ {x:0,y:0}, {x:W,y:0}, {x:W,y:W}, {x:0,y:W} ];
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 10; ctx.setLineDash([20, 10]);
    for (let i = 0; i < corners.length; i++) {
      const a = this.worldToScreen(corners[i].x, corners[i].y);
      const b = this.worldToScreen(corners[(i + 1) % 4].x, corners[(i + 1) % 4].y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}

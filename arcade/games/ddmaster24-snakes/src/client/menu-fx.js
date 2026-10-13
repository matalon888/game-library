// Menu visuals: ambient background snakes + a live preview of your snake. Browser-only.

class _MenuSnake {
  constructor(w, h, color, opts = {}) {
    this.w = w; this.h = h; this.color = color;
    this.len = opts.len || 26;
    this.radius = opts.radius || 6;
    this.t = Math.random() * 1000;
    this.ax = (opts.ax != null ? opts.ax : (0.22 + Math.random() * 0.28)) * w;
    this.ay = (opts.ay != null ? opts.ay : (0.22 + Math.random() * 0.28)) * h;
    this.wx = opts.wx != null ? opts.wx : 40;
    this.wy = opts.wy != null ? opts.wy : 30;
    this.fx = 0.2 + Math.random() * 0.4;
    this.fy = 0.25 + Math.random() * 0.5;
    this.phase = Math.random() * Math.PI * 2;
    this.points = [];
    const start = this._head(this.t);
    for (let i = 0; i < this.len; i++) this.points.push({ x: start.x, y: start.y });
    this.angle = 0;
  }
  _head(t) {
    return {
      x: this.w / 2 + Math.cos(t * this.fx + this.phase) * this.ax + Math.cos(t * 0.13) * this.wx,
      y: this.h / 2 + Math.sin(t * this.fy) * this.ay + Math.sin(t * 0.17) * this.wy,
    };
  }
  update(dt) {
    this.t += dt;
    this.points.unshift(this._head(this.t));
    if (this.points.length > this.len) this.points.pop();
    const a = this.points[0];
    const b = this.points[Math.min(3, this.points.length - 1)];
    this.angle = Math.atan2(a.y - b.y, a.x - b.x);
  }
  draw(ctx, alpha, drawEyes) {
    const r = this.radius;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      const g = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 2);
      g.addColorStop(0, this.color); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (drawEyes) {
      const hp = this.points[0];
      for (const side of [-1, 1]) {
        const ex = hp.x + Math.cos(this.angle + side * 0.5) * r * 0.6;
        const ey = hp.y + Math.sin(this.angle + side * 0.5) * r * 0.6;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0a0a15'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.18, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Ambient slithering snakes drawn faintly behind the menu.
class BackgroundFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.snakes = [];
    this.running = false;
    this.last = 0;
    this._loop = this._loop.bind(this);
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }
  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    const palette = ['#00ff88', '#3fd8ff', '#6c5ce7', '#fd79a8', '#f9ca24', '#4ecdc4'];
    const count = Math.max(4, Math.min(8, Math.floor(window.innerWidth / 260)));
    this.snakes = [];
    for (let i = 0; i < count; i++) {
      this.snakes.push(new _MenuSnake(this.canvas.width, this.canvas.height, palette[i % palette.length], {
        len: 22 + (i % 4) * 6, radius: 5 + (i % 3) * 2, wx: 60, wy: 50,
      }));
    }
  }
  start() { if (this.running) return; this.running = true; this.last = (typeof performance !== 'undefined' ? performance.now() : 0); requestAnimationFrame(this._loop); }
  stop() { this.running = false; }
  _loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.05); this.last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const s of this.snakes) { s.update(dt); s.draw(ctx, 0.16, false); }
    requestAnimationFrame(this._loop);
  }
}

// The live preview of YOUR snake, in the chosen color, on a small canvas.
class SnakePreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.color = '#00ff88';
    this.snake = new _MenuSnake(canvas.width, canvas.height, this.color, {
      len: 30, radius: 9, ax: 0.3, ay: 0.14, wx: 26, wy: 10,
    });
    this.running = false;
    this.last = 0;
    this._loop = this._loop.bind(this);
  }
  setColor(c) { this.color = c; if (this.snake) this.snake.color = c; }
  start() { if (this.running) return; this.running = true; this.last = (typeof performance !== 'undefined' ? performance.now() : 0); requestAnimationFrame(this._loop); }
  stop() { this.running = false; }
  _loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.05); this.last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.snake.update(dt);
    this.snake.draw(ctx, 1, true);
    requestAnimationFrame(this._loop);
  }
}

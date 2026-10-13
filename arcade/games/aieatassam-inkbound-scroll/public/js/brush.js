// Sumi-e brush, stamp-based renderer.
// - Logical coordinate space 880x440 (sync-safe across clients)
// - devicePixelRatio-aware backing store for crisp ink
// - Width from pen pressure or pointer speed (slow = thick, fast = thin)
// - Catmull-Rom smoothing, stamped dabs with deterministic bristle grain
// - Dry-brush splitting at high speed, ink pooling on stroke start/end

export const LOGICAL_W = 880;
export const LOGICAL_H = 440;

const INKS = {
  sumi: { core: [28, 26, 23], alpha: 0.9 },
  vermillion: { core: [176, 48, 44], alpha: 0.85 },
};

const SIZES = { fine: { min: 1, max: 7 }, bold: { min: 2, max: 16 } };

// deterministic pseudo-random from coords — identical grain on every client
function grain(x, y, i) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + i * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

export class Brush {
  constructor(canvas, { onStroke, onStrokeStart, onStrokeEnd } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onStroke = onStroke;
    this.onStrokeStart = onStrokeStart;
    this.onStrokeEnd = onStrokeEnd;
    this.strokes = [];
    this.current = null;
    this.ink = "sumi";
    this.size = "bold";
    this._setupDpr();
    this._bind();
  }

  _setupDpr() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = LOGICAL_W * dpr;
    this.canvas.height = LOGICAL_H * dpr;
    this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this._down(e));
    c.addEventListener("pointermove", (e) => this._move(e));
    window.addEventListener("pointerup", () => this._up());
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (LOGICAL_W / r.width),
      y: (e.clientY - r.top) * (LOGICAL_H / r.height),
    };
  }

  _limits() { return SIZES[this.size] || SIZES.bold; }

  _width(e, p) {
    const { min, max } = this._limits();
    if (e.pressure && e.pressure !== 0.5) {
      return min + e.pressure * (max - min);
    }
    const pts = this.current.points;
    const last = pts[pts.length - 1];
    if (!last) return max * 0.55;
    const dt = Math.max(1, e.timeStamp - this._lastT);
    const speed = Math.hypot(p.x - last.x, p.y - last.y) / dt;
    const target = max - Math.min(1, speed / 1.5) * (max - min);
    return last.w * 0.72 + target * 0.28;
  }

  _down(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this._pos(e);
    this._lastT = e.timeStamp;
    const { max } = this._limits();
    this.current = {
      ink: this.ink,
      points: [{ x: p.x, y: p.y, w: max * 0.5 }],
    };
    // ink pooling where the brush first touches
    this._stampDab(p.x, p.y, max * 0.55, INKS[this.ink], 0.5, 0);
    this.onStrokeStart?.();
  }

  _move(e) {
    if (!this.current) return;
    const p = this._pos(e);
    // coalesced events for smoother high-frequency input where available
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events) {
      const q = this._pos(ev);
      const w = this._width(ev, q);
      this._lastT = ev.timeStamp;
      const pts = this.current.points;
      const prev = pts[pts.length - 1];
      if (Math.hypot(q.x - prev.x, q.y - prev.y) < 0.8) continue;
      pts.push({ x: q.x, y: q.y, w });
      this._renderSegment(this.current, pts.length - 1, true);
    }
    void p;
  }

  _up() {
    if (!this.current) return;
    this.onStrokeEnd?.();
    const pts = this.current.points;
    if (pts.length > 1) {
      // tapered lift-off
      const tail = pts[pts.length - 1];
      this._stampDab(tail.x, tail.y, tail.w * 0.35, INKS[this.current.ink], 0.35, 1);
      this.strokes.push(this.current);
      this.onStroke?.(this.current);
    }
    this.current = null;
  }

  // ── rendering ──

  // Catmull-Rom point for segment p1→p2 with neighbors p0, p3
  _crPoint(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    const f = (a, b, c, d) =>
      0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 +
             (-a + 3 * b - 3 * c + d) * t3);
    return {
      x: f(p0.x, p1.x, p2.x, p3.x),
      y: f(p0.y, p1.y, p2.y, p3.y),
      w: p1.w + (p2.w - p1.w) * t,
    };
  }

  _stampDab(x, y, r, inkDef, alpha, seedI) {
    const ctx = this.ctx;
    const [cr, cg, cb] = inkDef.core;
    // soft bleed halo
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha * 0.13})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    // ink body
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // bristle grain: few offset specks, deterministic
    for (let i = 0; i < 3; i++) {
      const g1 = grain(x, y, seedI + i);
      const g2 = grain(y, x, seedI + i + 11);
      const ox = (g1 - 0.5) * r * 1.7;
      const oy = (g2 - 0.5) * r * 1.7;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha * (0.25 + g1 * 0.3)})`;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r * (0.12 + g2 * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // render the segment ending at point index `idx`
  _renderSegment(stroke, idx, live) {
    const pts = stroke.points;
    if (idx < 1) return;
    const inkDef = INKS[stroke.ink] || INKS.sumi;
    const p0 = pts[idx - 2] || pts[idx - 1];
    const p1 = pts[idx - 1];
    const p2 = pts[idx];
    const p3 = pts[idx + 1] || p2; // live: no lookahead — slight corner ok
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const avgW = (p1.w + p2.w) / 2;
    const spacing = Math.max(0.9, avgW * 0.28);
    const steps = Math.max(1, Math.ceil(dist / spacing));
    // dry brush: fast + thin strokes lose ink coverage
    const { min, max } = SIZES.bold;
    const dryness = 1 - Math.min(1, (avgW - min) / (max - min)); // thin => dry
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const q = this._crPoint(p0, p1, p2, p3, t);
      const g = grain(q.x, q.y, idx * 7 + s);
      if (dryness > 0.55 && g < dryness * 0.35) continue; // skipped dab = bristle gap
      const alpha = inkDef.alpha * (0.75 + g * 0.25);
      this._stampDab(q.x, q.y, Math.max(0.5, q.w / 2), inkDef, alpha, idx * 13 + s);
    }
    void live;
  }

  drawStroke(stroke) {
    for (let i = 1; i < stroke.points.length; i++) {
      this._renderSegment(stroke, i, false);
    }
    this.strokes.push(stroke);
  }

  redraw() {
    this.ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    const all = this.strokes;
    this.strokes = [];
    for (const s of all) this.drawStroke(s);
  }

  undo() {
    this.strokes.pop();
    this.redraw();
  }

  clear() {
    this.strokes = [];
    this.ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  isEmpty() {
    return this.strokes.length === 0;
  }

  // white-backed PNG for the vision model (downscaled to logical size)
  toDataURL() {
    const off = document.createElement("canvas");
    off.width = LOGICAL_W;
    off.height = LOGICAL_H;
    const octx = off.getContext("2d");
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    octx.drawImage(this.canvas, 0, 0, LOGICAL_W, LOGICAL_H);
    return off.toDataURL("image/png");
  }
}

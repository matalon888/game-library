// rope.js — Snip Snack's own 2D verlet physics: a candy particle hanging on tension-only rope chains,
// a bubble that floats the candy up, and air cushions that puff it sideways. Fixed 1/120 s step => deterministic.
export const DT = 1 / 120, G = -24, SEG = 0.3, ITER = 26;

export class Sim {
  constructor() { this.P = []; this.ropes = []; this.candy = null; this.bubble = null; this.inBubble = false; this.cushions = []; this.events = []; this.steps = 0; }
  particle(x, y, inv, damp = 0.996) { const p = { x, y, ox: x, oy: y, inv, damp }; this.P.push(p); return p; }
  addCandy(x, y) { this.candy = this.particle(x, y, 0.25, 0.9993); this.candy.ang = 0; }
  addRope(px, py) {
    const c = this.candy, pin = this.particle(px, py, 0), d = Math.hypot(c.x - px, c.y - py);
    const n = Math.max(3, Math.ceil(d / SEG)), L = d / n, pts = [pin];
    for (let i = 1; i < n; i++) { const t = i / n; pts.push(this.particle(px + (c.x - px) * t, py + (c.y - py) * t, 1, 0.99)); }
    pts.push(c);
    const segs = []; for (let i = 0; i < n; i++) segs.push({ a: pts[i], b: pts[i + 1], L, alive: true });
    const r = { pin, pts, segs, id: this.ropes.length, cut: false }; this.ropes.push(r); return r;
  }
  get free() { return this.ropes.every(r => r.cut); }
  step() {
    const dt2 = DT * DT, c = this.candy;
    for (const p of this.P) {
      if (!p.inv) continue;
      let vx = (p.x - p.ox) * p.damp, vy = (p.y - p.oy) * p.damp, ay = G;
      if (p === c && this.inBubble) { vx *= 0.982; vy *= 0.982; ay = 5; }
      p.ox = p.x; p.oy = p.y; p.x += vx; p.y += vy + ay * dt2;
    }
    for (let it = 0; it < ITER; it++) for (const r of this.ropes) for (const s of r.segs) {
      if (!s.alive) continue;
      const a = s.a, b = s.b, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d <= s.L || d === 0) continue;                       // ropes only pull, never push
      const w = a.inv + b.inv; if (!w) continue;
      const k = (d - s.L) / (d * w);
      a.x += dx * k * a.inv; a.y += dy * k * a.inv; b.x -= dx * k * b.inv; b.y -= dy * k * b.inv;
    }
    const bb = this.bubble;
    if (bb && !bb.used && Math.hypot(c.x - bb.x, c.y - bb.y) < bb.r + 0.3) { bb.used = true; this.inBubble = true; this.events.push({ t: 'bubble', x: c.x, y: c.y }); }
    c.ang -= (c.x - c.ox) * 2.2;
    this.steps++;
  }
}

function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1x = bx - ax, r1y = by - ay, r2x = dx - cx, r2y = dy - cy, den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * r2y - (cy - ay) * r2x) / den, u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: ax + r1x * t, y: ay + r1y * t } : null;
}
/** a finger stroke from A to B: cuts every rope it crosses (the crossed link closest to the stroke middle) */
export function swipe(sim, ax, ay, bx, by) {
  const out = [], mx = (ax + bx) / 2, my = (ay + by) / 2;
  for (const r of sim.ropes) {
    let best = null, bd = 1e9;
    for (const s of r.segs) { if (!s.alive) continue; const h = segHit(ax, ay, bx, by, s.a.x, s.a.y, s.b.x, s.b.y); if (h) { const d = Math.hypot(h.x - mx, h.y - my); if (d < bd) { bd = d; best = { s, h }; } } }
    if (best) { best.s.alive = false; r.cut = true; out.push({ t: 'cut', rope: r.id, x: best.h.x, y: best.h.y }); }
  }
  sim.events.push(...out); return out.length;
}
/** a finger press: pops the bubble if it's on the candy, or fires an air cushion */
export function press(sim, x, y) {
  const c = sim.candy;
  if (sim.inBubble && Math.hypot(c.x - x, c.y - y) < 1.3) { sim.inBubble = false; sim.events.push({ t: 'pop', x: c.x, y: c.y }); return 'pop'; }
  for (const k of sim.cushions) if (Math.hypot(k.x - x, k.y - y) < 1.0) {
    const d = Math.hypot(c.x - k.x, c.y - k.y), str = 11 * Math.max(0, 1 - d / 13);
    c.ox -= k.dir * str * DT; c.oy -= 1.5 * str * DT * 0.2;
    sim.events.push({ t: 'blow', k }); return 'blow';
  }
  return null;
}
/** the stroke a bot (or the generator) uses to cut rope i: short, perpendicular, through the middle link */
export function botStroke(sim, i) {
  const r = sim.ropes[i], s = r.segs[Math.floor(r.segs.length * 0.5)];
  const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2; let dx = s.b.x - s.a.x, dy = s.b.y - s.a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  return [mx + dy * 0.35, my - dx * 0.35, mx - dy * 0.35, my + dx * 0.35];
}

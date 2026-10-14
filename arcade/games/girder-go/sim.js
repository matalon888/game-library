// sim.js — Girder Go bridge physics (our own code). 2D XPBD truss: pin-jointed beams as compliant distance
// constraints solved with many small substeps; beam force = lambda / h^2 gives a real stress reading per beam,
// beams over their strength snap. The vehicle is two wheel particles on a rigid axle; wheels collide with road
// beams (load is pushed back into the beam's two end nodes) and with the static cliff ground.
export const MATS = {
  road:  { cost: 200, mass: 0.3, strength: 60, comp: 3e-4, maxLen: 2.3 },
  wood:  { cost: 100, mass: 0.12, strength: 50, comp: 4e-4, maxLen: 2.3 },
  steel: { cost: 320, mass: 0.22, strength: 140, comp: 1.2e-4, maxLen: 2.3 },
};
const G = -9.8;

export function createSim(design, ground, car) {
  const nodes = design.nodes.map(n => ({ x: n.x, y: n.y, px: n.x, py: n.y, vx: 0, vy: 0, w: 0, fixed: !!n.fixed, m: 0 }));
  const beams = design.beams.filter(b => !b.dead).map(b => {
    const A = nodes[b.a], B = nodes[b.b], rest = Math.hypot(B.x - A.x, B.y - A.y), M = MATS[b.type];
    A.m += M.mass * rest / 2; B.m += M.mass * rest / 2;
    return { a: b.a, b: b.b, type: b.type, rest, M, broken: false, stress: 0, force: 0, src: b };
  });
  for (const n of nodes) n.w = n.fixed || n.m <= 0 ? 0 : 1 / n.m;
  const wheels = [];
  if (car) for (let i = 0; i < 2; i++) wheels.push({ x: car.x + (i ? car.axle : 0), y: car.y, px: 0, py: 0, vx: 0, vy: 0, w: 1 / car.wheelMass, r: car.r, contact: 0, nx: 0, ny: 1 });
  for (const w of wheels) { w.px = w.x; w.py = w.y; }
  return { nodes, beams, wheels, ground, car, t: 0, broke: [], drive: car ? car.speed : 0 };
}

function solveBeam(s, b, h2) {
  const A = s.nodes[b.a], B = s.nodes[b.b];
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-9;
  const wsum = A.w + B.w; if (wsum === 0) return;
  const C = d - b.rest, alpha = b.M.comp * b.rest / h2;
  const dl = -C / (wsum + alpha);
  const nx = dx / d, ny = dy / d;
  A.x -= nx * dl * A.w; A.y -= ny * dl * A.w; B.x += nx * dl * B.w; B.y += ny * dl * B.w;
  b.force = -dl / h2;   // >0 tension
}

function contactSeg(wh, ax, ay, bx, by, A, B) {
  const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey || 1e-9;
  let t = ((wh.x - ax) * ex + (wh.y - ay) * ey) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + ex * t, cy = ay + ey * t; let nx = wh.x - cx, ny = wh.y - cy; const d = Math.hypot(nx, ny);
  if (d >= wh.r) return false;
  if (d < 1e-6) { const L = Math.sqrt(L2); nx = -ey / L; ny = ex / L; } else { nx /= d; ny /= d; }
  if (ny < -0.2) return false;   // only push wheels upward-ish (driving on top of decks)
  const C = wh.r - d, wa = A ? A.w * (1 - t) * (1 - t) : 0, wb = B ? B.w * t * t : 0, wsum = wh.w + wa + wb;
  const dl = C / wsum;
  wh.x += nx * dl * wh.w; wh.y += ny * dl * wh.w;
  if (A) { A.x -= nx * dl * A.w * (1 - t); A.y -= ny * dl * A.w * (1 - t); }
  if (B) { B.x -= nx * dl * B.w * t; B.y -= ny * dl * B.w * t; }
  wh.contact = 3; wh.nx = nx; wh.ny = ny; return true;
}

export function stepSim(s, dt, sub = 40) {
  const h = dt / sub, h2 = h * h;
  const g = G * Math.min(1, 0.2 + s.t / 0.6);   // ease gravity in so the bridge settles without a shock
  for (let k = 0; k < sub; k++) {
    for (const n of s.nodes) { if (!n.w) continue; n.vy += g * h; n.px = n.x; n.py = n.y; n.x += n.vx * h; n.y += n.vy * h; }
    for (const w of s.wheels) { w.vy += G * h; w.px = w.x; w.py = w.y; w.x += w.vx * h; w.y += w.vy * h; }
    for (const b of s.beams) if (!b.broken) solveBeam(s, b, h2);
    if (s.wheels.length) {
      const [a, b] = s.wheels; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-9, C = d - s.car.axle, ws = a.w + b.w;
      const dl = -C / ws; a.x -= dx / d * dl * a.w; a.y -= dy / d * dl * a.w; b.x += dx / d * dl * b.w; b.y += dy / d * dl * b.w;
      for (const w of s.wheels) {
        w.contact = Math.max(0, w.contact - 1);
        for (const g of s.ground) contactSeg(w, g[0], g[1], g[2], g[3], null, null);
        for (const bm of s.beams) if (!bm.broken && bm.type === 'road') { const A = s.nodes[bm.a], B = s.nodes[bm.b]; contactSeg(w, A.x, A.y, B.x, B.y, A, B); }
      }
    }
    const damp = 1 - 0.6 * h;
    for (const n of s.nodes) { if (!n.w) continue; n.vx = (n.x - n.px) / h * damp; n.vy = (n.y - n.py) / h * damp; }
    for (const w of s.wheels) {
      w.vx = (w.x - w.px) / h; w.vy = (w.y - w.py) / h;
      if (w.contact) { const tx = w.ny, ty = -w.nx, vt = w.vx * tx + w.vy * ty, dv = (s.drive - vt) * 0.08; w.vx += tx * dv; w.vy += ty * dv; }
    }
    // stress + breaking (checked every substep so peaks count, smoothed for display)
    for (const b of s.beams) {
      if (b.broken) continue;
      const f = b.force, lim = f > 0 ? b.M.strength : b.M.strength * 0.85, st = Math.abs(f) / lim;
      b.stress += (st - b.stress) * 0.02;
      if (b.stress > 1) { b.broken = true; s.broke.push(b); }
    }
  }
  s.t += dt;
}

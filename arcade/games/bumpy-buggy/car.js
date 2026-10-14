// Bumpy Buggy — 2D car physics (our own code): rigid chassis + 2 wheel bodies on anisotropic spring-damper
// suspension, impulse wheel/terrain contact with friction coupling to wheel spin, engine torque with reaction,
// hull-point collisions and air control. Run at a fixed small substep (1/480 s) so nothing tunnels.
export const WHEEL_R = 0.46;
const G = -16, KU = 70, CU = 5, KS = 700, CS = 12, TRAVEL = 0.26, KSTOP = 900;
const MU = 1.15, VMAX = 21, VREV = 6, TORQUE = 5.2, BRAKE = 9, REACT = 0.32, AIR = 5;
export const HULL = [[-1.45, -0.28], [1.45, -0.28], [1.45, 0.3], [-1.45, 0.38], [-0.78, 1.18], [0.6, 0.62]];
export const HEAD = [-0.22, 1.0], HEAD_R = 0.3;

export function createCar(x, y) {
  const wheel = (lx, drive) => ({ lx, ly: -0.52, p: { x: x + lx, y: y - 0.52 }, v: { x: 0, y: 0 }, om: 0, ang: 0, m: 0.16, I: 0.5 * 0.16 * WHEEL_R * WHEEL_R, drive, contact: false, comp: 0, hitJ: 0 });
  return { p: { x, y }, v: { x: 0, y: 0 }, a: 0, w: 0, M: 1, I: 0.95, wheels: [wheel(-1.02, 1), wheel(1.05, 0.8)], airT: 0, airRot: 0, crashed: false, grounded: false, landJ: 0, bodyHit: 0 };
}
const cross = (ax, ay, bx, by) => ax * by - ay * bx;

// impulse at world-offset (rx, ry) on the chassis
function applyImp(c, rx, ry, jx, jy) { c.v.x += jx / c.M; c.v.y += jy / c.M; c.w += cross(rx, ry, jx, jy) / c.I; }

export function stepCar(c, T, ctl, dt) {
  const cs = Math.cos(c.a), sn = Math.sin(c.a);
  const ux = -sn, uy = cs, sx = cs, sy = sn;
  // ---- suspension forces
  for (const wh of c.wheels) {
    const rx = cs * wh.lx - sn * wh.ly, ry = sn * wh.lx + cs * wh.ly;
    const Ax = c.p.x + rx, Ay = c.p.y + ry, vAx = c.v.x - c.w * ry, vAy = c.v.y + c.w * rx;
    const dx = Ax - wh.p.x, dy = Ay - wh.p.y, dvx = vAx - wh.v.x, dvy = vAy - wh.v.y;
    const du = dx * ux + dy * uy, ds = dx * sx + dy * sy;
    let fu = KU * du + CU * (dvx * ux + dvy * uy);
    if (du < -TRAVEL) fu += KSTOP * (du + TRAVEL); else if (du > TRAVEL) fu += KSTOP * (du - TRAVEL);
    const fs = KS * ds + CS * (dvx * sx + dvy * sy);
    const Fx = ux * fu + sx * fs, Fy = uy * fu + sy * fs;
    wh.v.x += Fx / wh.m * dt; wh.v.y += Fy / wh.m * dt;
    applyImp(c, rx, ry, -Fx * dt, -Fy * dt);
    wh.comp = du;
  }
  // ---- gravity
  c.v.y += G * dt; for (const wh of c.wheels) wh.v.y += G * dt;
  // ---- engine / brake
  const gas = ctl.gas && !ctl.noFuel, brake = ctl.brake;
  for (const wh of c.wheels) {
    let tq = 0;
    if (gas) { if (-wh.om * WHEEL_R < VMAX) tq = -TORQUE * wh.drive; }
    else if (brake) {
      if (wh.om < -1) tq = Math.min(BRAKE * wh.drive, -wh.om * wh.I / dt);
      else if (wh.om * WHEEL_R < VREV) tq = TORQUE * 0.7 * wh.drive;
    } else wh.om *= 1 - 0.35 * dt;
    wh.om += tq / wh.I * dt;
    if (c.grounded) c.w -= tq * REACT / c.I * dt;   // reaction torque: gas lifts the nose
  }
  if (!c.grounded) { const k = gas ? 1 : brake ? -1 : 0; c.w += k * AIR * dt; c.w *= 1 - 0.9 * dt; }
  else c.w *= 1 - 0.6 * dt;
  c.v.x *= 1 - 0.01 * dt;
  // ---- integrate
  c.p.x += c.v.x * dt; c.p.y += c.v.y * dt; c.a += c.w * dt;
  for (const wh of c.wheels) { wh.p.x += wh.v.x * dt; wh.p.y += wh.v.y * dt; wh.ang += wh.om * dt; }
  // ---- wheel contacts
  let anyC = false;
  for (const wh of c.wheels) {
    const ct = T.circle(wh.p.x, wh.p.y, WHEEL_R);
    wh.contact = false;
    if (!ct || ct.pen <= 0) continue;
    wh.contact = true; anyC = true;
    const nx = ct.nx, ny = ct.ny, tx = ny, ty = -nx;
    wh.p.x += nx * ct.pen; wh.p.y += ny * ct.pen;
    const vn = wh.v.x * nx + wh.v.y * ny;
    let jn = 0;
    if (vn < 0) { jn = -vn * 1.08 * wh.m; wh.v.x += nx * jn / wh.m; wh.v.y += ny * jn / wh.m; }
    wh.hitJ = Math.max(wh.hitJ, -vn);
    const slip = wh.v.x * tx + wh.v.y * ty + wh.om * WHEEL_R;
    let jt = -slip / (1 / wh.m + WHEEL_R * WHEEL_R / wh.I);
    const lim = MU * Math.max(jn, wh.m * 2 * dt);
    jt = Math.max(-lim, Math.min(lim, jt));
    wh.v.x += tx * jt / wh.m; wh.v.y += ty * jt / wh.m; wh.om += WHEEL_R * jt / wh.I;
  }
  // ---- chassis hull vs ground
  const cs2 = Math.cos(c.a), sn2 = Math.sin(c.a);
  for (const [lx, ly] of HULL) {
    const rx = cs2 * lx - sn2 * ly, ry = sn2 * lx + cs2 * ly, px = c.p.x + rx, py = c.p.y + ry, h = T.h(px);
    if (py >= h) continue;
    const nn = T.normal(px), pen = (h - py) * nn.y;
    c.p.x += nn.x * pen; c.p.y += nn.y * pen;
    const vx = c.v.x - c.w * ry, vy = c.v.y + c.w * rx, vn = vx * nn.x + vy * nn.y;
    if (vn < 0) {
      const rn = cross(rx, ry, nn.x, nn.y), j = -1.2 * vn / (1 / c.M + rn * rn / c.I);
      applyImp(c, rx, ry, nn.x * j, nn.y * j);
      const tx = nn.y, ty = -nn.x, vt = (c.v.x - c.w * ry) * tx + (c.v.y + c.w * rx) * ty, rt = cross(rx, ry, tx, ty);
      let jt = -vt / (1 / c.M + rt * rt / c.I); jt = Math.max(-0.6 * j, Math.min(0.6 * j, jt));
      applyImp(c, rx, ry, tx * jt, ty * jt);
      c.bodyHit = Math.max(c.bodyHit, -vn);
    }
  }
  // ---- head = crash
  const hx = c.p.x + cs2 * HEAD[0] - sn2 * HEAD[1], hy = c.p.y + sn2 * HEAD[0] + cs2 * HEAD[1];
  if (hy - HEAD_R < T.h(hx)) c.crashed = true;
  // ---- air tracking
  if (anyC) { if (!c.grounded && c.airT > 0.05) c.landed = { t: c.airT, rot: c.airRot }; c.airT = 0; c.airRot = 0; }
  else { c.airT += dt; c.airRot += c.w * dt; }
  c.grounded = anyC;
}
export function headPos(c) { const cs = Math.cos(c.a), sn = Math.sin(c.a); return { x: c.p.x + cs * HEAD[0] - sn * HEAD[1], y: c.p.y + sn * HEAD[0] + cs * HEAD[1] }; }

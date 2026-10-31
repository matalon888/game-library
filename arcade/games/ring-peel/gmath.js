// Ring Peel — guard-wall maths shared by the game (deep.js) and the offline calibration (qa/calib.mjs). No DOM, no three.
export const OR = 2.55, TR = 1.3, PR = 3.5, BALL_SPEED = 24, FIRE_DT = 0.1, PI2 = Math.PI * 2;
export const wrap = a => { a = (a + Math.PI) % PI2; if (a < 0) a += PI2; return a - Math.PI; };
// a guard: { mode: 'spin'|'swing'|'surge'|'blink', w (arc width, rad), sp, a0, amp, ph, sp2, on, off }
export function guardAngle(g, t) {
  if (g.mode === 'swing') return g.a0 + g.amp * Math.sin(g.sp * t + g.ph);
  if (g.mode === 'surge') return g.a0 + g.sp * t + 0.9 * Math.sin(g.sp2 * t + g.ph);
  return g.a0 + g.sp * t;                      // spin, blink (a blinking wall turns slowly too)
}
// is the wall there at time t? only blink walls vanish: solid `on` seconds, open `off` seconds
export function solid(g, t) { if (g.mode !== 'blink') return true; const P = g.on + g.off; return (((t + g.ph) % P) + P) % P < g.on; }
// seconds until a blink wall turns solid (0 when it already is / not a blink wall)
export function untilSolid(g, t) { if (g.mode !== 'blink' || solid(g, t)) return 0; const P = g.on + g.off; return P - ((((t + g.ph) % P) + P) % P); }
export function blocked(guards, t, margin = 0) {
  for (const g of guards) if (solid(g, t) && Math.abs(wrap(guardAngle(g, t))) < g.w / 2 + 0.085 + margin) return g;
  return null;
}
// angular room left between the ball path and the nearest solid wall edge at time t (graze test)
export function room(guards, t) {
  let m = 9; for (const g of guards) if (solid(g, t)) m = Math.min(m, Math.abs(wrap(guardAngle(g, t))) - (g.w / 2 + 0.085));
  return m;
}
// is the whole flight through the guard band clear if a ball leaves the cannon `lead` s from now? (cannon at distance dz)
export function safeShot(guards, gt, dz, margin = 0.12) {
  const tA = (dz - (OR + 0.45)) / BALL_SPEED, tB = (dz - (OR - 0.45)) / BALL_SPEED;
  for (let f = 0; f <= 0.24; f += 0.02) for (let t = tA; t <= tB; t += 0.01) if (blocked(guards, gt + f + t, margin)) return false;
  return true;
}

// How long the safe-shooting bot needs for one tower (offline and in-game: sets each pier's par). S = { r rings, g guards, gold/arm/bomb ring numbers }.
export function botTime(S) {
  const dz = 8 - 0.75, fly = (dz - TR - 0.15) / BALL_SPEED, gs = S.g.map(g => ({ ph: 0, amp: 1.2, sp2: 2, on: 1, off: 1, ...g }));
  const hp = []; for (let i = 0; i < S.r; i++) hp.push(S.arm.includes(i) ? 2 : 1);
  let removed = 0, t = 0, fireT = 0; const fl = [];
  while (removed < S.r && t < 300) {
    fireT -= 0.02; if (safeShot(gs, t, dz) && fireT <= 0) { fl.push(t + fly); fireT = FIRE_DT; }
    while (fl.length && fl[0] <= t) { fl.shift(); const i = removed; if (i >= S.r) continue; if (--hp[i] > 0) continue; removed++; if (S.bomb.includes(i)) for (let k = 0; k < 3 && removed < S.r; k++) removed++; }
    t += 0.02;
  }
  return t;
}
export const parOf = stages => Math.round(stages.reduce((a, s) => a + botTime(s) * 1.5 + 3, 0));

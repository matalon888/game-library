// level.js — seeded level generator. Every level is built around a known action plan (cut order + timings, bubble pop,
// cushion puff), simulated with the real physics; the hedgehog sits where that plan lands the candy and the stars sit on
// its path, so every level is solvable by construction. The same plan drives the test bot.
import { Sim, swipe, press, botStroke } from './rope.js';

function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
export function buildSim(L) {
  const s = new Sim(); s.addCandy(L.candy.x, L.candy.y);
  for (const p of L.pins) s.addRope(p.x, p.y);
  if (L.bubble) s.bubble = { x: L.bubble.x, y: L.bubble.y, r: 0.75, used: false };
  s.cushions = L.cushions.map(c => ({ ...c }));
  return s;
}
/** perform one plan action exactly the way the pointer handler does (down -> optional move) */
export function act(sim, a) {
  if (a.type === 'cut') { const [ax, ay, bx, by] = botStroke(sim, a.rope); press(sim, ax, ay); swipe(sim, ax, ay, bx, by); return [ax, ay, bx, by]; }
  if (a.type === 'pop') { const c = sim.candy; press(sim, c.x, c.y); return [c.x, c.y]; }
  if (a.type === 'blow') { const k = sim.cushions[0]; press(sim, k.x, k.y); return [k.x, k.y]; }
}

export function generate(level, fk = 1) {
  for (let att = 0; att < 600; att++) {
    const L = tryLevel(level, rng(level * 9973 + att * 7919 + 17), fk);
    if (L) { L.attempt = att; return L; }
  }
  return null;
}

function tryLevel(level, r, fk = 1) {
  const nR = level === 1 ? 1 : level <= 3 ? 2 : (r() < Math.min(0.85, Math.max(0.25, 1 - 0.45 * fk)) ? 2 : 3);
  const candy = { x: (r() * 2 - 1) * 2.3, y: 0.6 + r() * 4.2 };
  const pins = [];
  for (let i = 0; i < nR; i++) {
    let ok = false;
    for (let k = 0; k < 30 && !ok; k++) {
      const p = level === 1
        ? { x: candy.x + (r() < 0.5 ? -1 : 1) * (1.8 + r() * 1.6), y: candy.y + 0.4 + r() * 2.2 }
        : { x: (r() * 2 - 1) * 4.1, y: candy.y - 0.5 + r() * (7.4 - candy.y + 0.5) };
      const d = Math.hypot(p.x - candy.x, p.y - candy.y);
      ok = Math.abs(p.x) < 4.2 && p.y < 7.5 && d > 1.4 && d < 5.6 && pins.every(q => Math.hypot(q.x - p.x, q.y - p.y) > 1.6);
      if (ok) pins.push(p);
    }
    if (!ok) return null;
  }
  const hasBubble = level >= 3 && (level === 3 || r() < 0.5);
  const hasCush = level >= 5 && r() < Math.min(0.8, (hasBubble ? 0.4 : 0.6) * fk);
  const order = pins.map((_, i) => i).sort(() => r() - 0.5);
  const plan = []; let t = 70 + Math.floor(r() * 80);
  for (const i of order) { plan.push({ step: t, type: 'cut', rope: i }); t += 35 + Math.floor(r() * 100); }
  const mouthY = -7.3 + r() * 1.6;
  if (candy.y - mouthY < 4.2) return null;
  const L = { level, candy, pins, bubble: null, cushions: [], plan, mouth: null, stars: [] };
  const releaseStep = plan[plan.length - 1].step;
  const floatSteps = 45 + Math.floor(r() * 70);
  const blowAfter = hasCush ? 12 + Math.floor(r() * 30) : -1, kyJit = (r() - 0.5) * 1.5;
  if (hasBubble) {
    // pass 1: where is the free-falling candy shortly after release? the bubble goes there
    const bubbleStep = releaseStep + 18 + Math.floor(r() * 30), sim = buildSim(L);
    while (sim.steps < bubbleStep) { for (const a of plan) if (a.step === sim.steps) act(sim, a); sim.step(); }
    const c = sim.candy; L.bubble = { x: c.x, y: c.y };
    if (Math.abs(c.x) > 3.6 || c.y < mouthY + 2.5) return null;
  }
  // pass 2: the real run with everything in place (pop + puff are scheduled as the run unfolds)
  const sim = buildSim(L);
  const traj = []; let lastAct = releaseStep, cross = -1, popStep = -1, blowStep = -1;
  for (let s = 0; s < 1500; s++) {
    const c = sim.candy;
    for (const a of plan) if (a.step === sim.steps) act(sim, a);
    if (hasBubble && popStep < 0 && sim.inBubble) {
      if (sim.steps < releaseStep) return null;
      popStep = sim.steps + floatSteps; plan.push({ step: popStep, type: 'pop' }); lastAct = popStep;
    }
    if (hasCush && blowStep < 0 && sim.steps === (hasBubble ? (popStep > 0 ? popStep : 1e9) : releaseStep) + blowAfter) {
      const dir = c.x > 0 ? -1 : 1, ky = c.y + kyJit;
      if (ky > 7.2 || ky < mouthY + 1.2) return null;
      const cush = { x: -dir * 4.0, y: ky, dir };
      if (Math.hypot(cush.x - c.x, cush.y - c.y) < 1.6) return null;
      L.cushions = [cush]; sim.cushions = [{ ...cush }];
      blowStep = sim.steps; const a = { step: blowStep, type: 'blow' }; plan.push(a); lastAct = blowStep; act(sim, a);
    }
    const py = c.y; sim.step();
    traj.push({ x: c.x, y: c.y, s: sim.steps });
    if (Math.abs(c.x) > 4.5 || c.y > 8.2 || c.y < -9) return null;
    if (sim.steps > lastAct + 2 && (!hasBubble || popStep > 0 && sim.steps > popStep) && (!hasCush || blowStep > 0) && py >= mouthY && c.y < mouthY) { cross = sim.steps; break; }
  }
  if (cross < 0) return null;
  if (hasBubble && popStep < 0) return null;
  const end = traj[traj.length - 1];
  if (Math.abs(end.x) > 3.3) return null;
  L.mouth = { x: end.x, y: mouthY };
  // the candy must not reach the mouth before the plan is done
  for (const p of traj) if (p.s < lastAct && Math.hypot(p.x - L.mouth.x, p.y - L.mouth.y) < 1.6) return null;
  if (L.bubble && Math.hypot(L.bubble.x - L.mouth.x, L.bubble.y - L.mouth.y) < 2.2) return null;
  // stars along the path after the first action
  const path = traj.filter(p => p.s >= plan[0].step);
  const acc = [0]; for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const tot = acc[acc.length - 1]; if (tot < 4) return null;
  for (const f of [0.18, 0.47, 0.74]) {
    let ok = false;
    for (const j of [0, 0.05, -0.05, 0.1, -0.08]) {
      const target = (f + j) * tot; let i = acc.findIndex(a => a >= target); if (i < 0) i = path.length - 1;
      const p = path[i];
      if (Math.hypot(p.x - L.mouth.x, p.y - L.mouth.y) < 1.7 || Math.hypot(p.x - candy.x, p.y - candy.y) < 0.9 || L.stars.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 1.2) || pins.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 0.7)) continue;
      L.stars.push({ x: p.x, y: p.y }); ok = true; break;
    }
    if (!ok) return null;
  }
  plan.sort((a, b) => a.step - b.step);
  L.cross = cross;
  return L;
}

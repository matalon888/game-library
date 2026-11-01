// resolve.js — turns an AUTHORED level spec (levels.js) into a playable level. The author chooses the pins, the candy, the
// cut order/timing, the bubble, the cushion and the hazards; the physics then finds where the candy lands (that is where
// Pip sleeps) and puts the stars on the path of the author's own solution. Nothing is random: same spec, same level.
import { Sim, swipe, press, botStroke } from './rope.js';
import { act } from './level.js';

export function buildSim2(L) {
  const s = new Sim(); s.addCandy(L.candy.x, L.candy.y);
  for (const p of L.pins) {
    const r = s.addRope(p.x, p.y);
    if (p.mv) { const [ax, ay, per, ph] = p.mv; s.mover(r.pin, p.x - ax * Math.sin(ph * Math.PI * 2), p.y - ay * Math.sin(ph * Math.PI * 2), ax, ay, per, ph); }
  }
  if (L.bubble) s.bubble = { x: L.bubble.x, y: L.bubble.y, r: 0.75, used: false };
  s.cushions = L.cushions.map(c => ({ ...c })); s.spikes = L.spikes || [];
  return s;
}
export const SPIKE_R = 0.62;
const hitSpike = (sim, c) => (sim.spikes || []).some(k => Math.hypot(k.x - c.x, k.y - c.y) < SPIKE_R);

/** run a plan from the start; returns the trajectory and what happened ('spike' | 'out' | 'cross' | 'timeout') */
export function run(L, plan, opts = {}) {
  const sim = buildSim2(L), traj = []; let end = 'timeout';
  const last = plan.reduce((m, a) => Math.max(m, a.step), 0);
  for (let s = 0; s < 1700; s++) {
    for (const a of plan) if (a.step === sim.steps && !a.skip) act(sim, a);
    const c = sim.candy, py = c.y; sim.step(); traj.push({ x: c.x, y: c.y, s: sim.steps });
    if (hitSpike(sim, c)) { end = 'spike'; break; }
    if (Math.abs(c.x) > 6.5 || c.y > 9.5 || c.y < -11) { end = 'out'; break; }
    if (sim.steps > last + 2 && c.y < L.mouthY && py >= L.mouthY) { end = 'cross'; break; }
  }
  return { traj, end, sim };
}

export function resolve(S) {
  const err = m => ({ err: `L${S.n}: ${m}` });
  const L = { level: S.n, candy: { x: S.candy[0], y: S.candy[1] }, pins: S.pins.map(p => ({ x: p[0], y: p[1], mv: p[2] || null })), bubble: null, cushions: [], spikes: (S.spikes || []).map(([x, y]) => ({ x, y })),
    plan: S.cuts.map(([step, rope]) => ({ step, type: 'cut', rope })), mouth: null, stars: [], mouthY: S.mouthY ?? -6.4, name: S.name, why: S.why, hard: !!S.hard, world: S.world, mr: S.mr || 0.9 };
  const plan = L.plan, releaseStep = Math.max(...plan.map(a => a.step));
  // bubble: sits where the free-falling candy is k steps after the last cut
  if (S.bubble) {
    const sim = buildSim2(L), bs = releaseStep + S.bubble[0];
    while (sim.steps < bs) { for (const a of plan) if (a.step === sim.steps) act(sim, a); sim.step(); }
    L.bubble = { x: sim.candy.x, y: sim.candy.y };
    if (Math.abs(L.bubble.x) > 3.8) return err('bubble off screen ' + L.bubble.x.toFixed(2));
  }
  // the real run, with pop / puff scheduled as it unfolds
  const sim = buildSim2(L), traj = []; let lastAct = releaseStep, popStep = -1, blowStep = -1, cross = -1, hit = null;
  for (let s = 0; s < 1700; s++) {
    const c = sim.candy;
    for (const a of plan) if (a.step === sim.steps) act(sim, a);
    if (S.bubble && popStep < 0 && sim.inBubble) { popStep = sim.steps + S.bubble[1]; plan.push({ step: popStep, type: 'pop' }); lastAct = popStep; }
    if (S.cush && blowStep < 0 && sim.steps === (S.bubble ? (popStep > 0 ? popStep : 1e9) : releaseStep) + S.cush[1]) {
      const dir = S.cush[2] ?? (c.x > 0 ? -1 : 1), ky = c.y + S.cush[0];
      const cush = { x: -dir * 4.0, y: ky, dir }; L.cushions = [cush]; sim.cushions = [{ ...cush }];
      blowStep = sim.steps; const a = { step: blowStep, type: 'blow' }; plan.push(a); lastAct = blowStep; act(sim, a);
    }
    const py = c.y; sim.step(); traj.push({ x: c.x, y: c.y, s: sim.steps });
    if (hitSpike(sim, c)) { hit = { x: c.x, y: c.y, s: sim.steps }; break; }
    if (Math.abs(c.x) > 4.7 || c.y > 8.4 || c.y < -9) return err(`candy leaves the box at step ${sim.steps} (${c.x.toFixed(1)},${c.y.toFixed(1)})`);
    if (sim.steps > lastAct + 2 && (!S.bubble || popStep > 0 && sim.steps > popStep) && (!S.cush || blowStep > 0) && py >= L.mouthY && c.y < L.mouthY) { cross = sim.steps; break; }
  }
  if (hit) return err(`own plan hits a spike at ${hit.x.toFixed(1)},${hit.y.toFixed(1)} step ${hit.s}`);
  if (cross < 0) return err('candy never reaches the mouth line');
  if (S.bubble && popStep < 0) return err('candy never enters the bubble');
  if (S.cush && blowStep < 0) return err('cushion never fires');
  const end = traj[traj.length - 1];
  if (Math.abs(end.x) > 3.4) return err('mouth too far out ' + end.x.toFixed(2));
  L.mouth = { x: end.x, y: L.mouthY };
  for (const p of traj) if (p.s < lastAct && Math.hypot(p.x - L.mouth.x, p.y - L.mouth.y) < 1.6) return err('candy passes the mouth before the plan is over');
  plan.sort((a, b) => a.step - b.step);
  // stars on the path of the author's solution (fractions of its length; swing stars are before the first cut)
  const path = traj, acc = [0]; for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const tot = acc[acc.length - 1];
  for (const f of S.stars || [0.22, 0.5, 0.78]) {
    let ok = false;
    for (const j of [0, 0.03, -0.03, 0.06, -0.06, 0.1, -0.1]) {
      const i = Math.max(0, acc.findIndex(a => a >= (f + j) * tot)), p = path[i < 0 ? path.length - 1 : i];
      if (Math.hypot(p.x - L.mouth.x, p.y - L.mouth.y) < 1.7 || Math.hypot(p.x - L.candy.x, p.y - L.candy.y) < 0.9 || L.stars.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 1.2) || L.pins.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 0.7) || L.spikes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 1.1) || Math.abs(p.x) > 4.2) continue;
      L.stars.push({ x: p.x, y: p.y, s: p.s }); ok = true; break;
    }
    if (!ok) return err('no room for a star at fraction ' + f);
  }
  // wrong choices: every other cut order with the same timings. Decoy spikes go where a wrong order lands.
  const alts = [], idx = plan.filter(a => a.type === 'cut').map(a => a.rope);
  const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
  const steps = plan.filter(a => a.type === 'cut').map(a => a.step);
  for (const order of perms(idx)) {
    if (order.every((v, i) => v === idx[i])) continue;
    const p2 = plan.map(a => a.type === 'cut' ? { ...a, rope: order[steps.indexOf(a.step)] } : { ...a, skip: false });
    const r = run(L, p2); const e = r.traj[r.traj.length - 1];
    alts.push({ order, end: r.end, x: e.x, y: e.y, win: r.end === 'cross' && Math.abs(e.x - L.mouth.x) < 0.9 });
  }
  L.alts = alts;
  if (S.decoy) {
    for (const a of alts) if (!a.win && a.end !== 'spike' && Math.abs(a.x - L.mouth.x) > 2.2 && Math.abs(a.x) < 4.3) {
      if (L.spikes.some(k => Math.hypot(k.x - a.x, k.y - a.y) < 1.4)) continue;
      L.spikes.push({ x: a.x, y: Math.max(a.y, -8.2) + 0.2 });
    }
  }
  L.cross = cross; return { L };
}

// Stretch Dash v2 — 30 hand-made levels in 3 worlds (studio lane 3, 2026-10-29). Plan: DESIGN.md.
// Lanes: gates are a pair [left, right] at x = -1.6 / +1.6 (the track is 6.4 m wide). Sizes are % of the starting jelly
// (H 1 = 1.8 m tall, W 1 = 0.72 m wide); mass = H × W is what the stairs at the end spend (0.25 a step).
// Rows (one every ROW_GAP metres):
//   G(a, b)          gate pair: 'h+30' taller, 'w-20' thinner, 'hx2' double height, 'w/2' halve width, null = no gate
//   S(gate, amp, hz) one gate sliding across the track (catch it or not)
//   B(h, side)       beam at h metres: slices off any jelly above it. side -1/1 = covers only that half
//   W(x, w, amp, hz) wall with a hole at x, w metres wide (sliding when amp): missing the hole = crash, too wide = squeeze
//   Dr([[x, w, h], …]) shape door: holes w wide and h tall; you are cut to the hole you go through
//   D(x, n, ax)      n jelly drops on lane x (+4 each on 'h' or 'w')
//   F(push, len)     wind belt pushing sideways (m/s) over len metres
// Row options: gm = lane of the gem trio after the row (default: the safe lane), gold = lane of the golden drop.
// stars: [2-star step, 3-star step] on the 21-step stairs (x1.0 … x5.0); 1 star = reach the stairs. Checked by qa/solve.cjs.

export const ROW_GAP = 16, STEP_COST = 0.25, STEPS = 21, MIN_H = 0.32, MIN_W = 0.4, BASE_H = 1.8, BASE_W = 0.72, MAX_H = 3.5, MAX_W = 3;
const G = (a, b, o) => ({ k: 'g', a, b, ...o });
const S = (a, amp = 2, hz = 0.5, o) => ({ k: 's', a, amp, hz, ...o });
const B = (h, side = 0, o) => ({ k: 'b', h, side, ...o });
const W = (x, w, amp = 0, hz = 0.5, o) => ({ k: 'w', x, w, amp, hz, ...o });
const Dr = (holes, o) => ({ k: 'r', holes, ...o });
const D = (x, n = 6, ax = 'h', o) => ({ k: 'd', x, n, ax, ...o });
const F = (push, len = 28, o) => ({ k: 'f', push, len, ...o });
const L = -1.6, Rr = 1.6;

export const WORLDS = [
  { name: 'Jelly Park', sky: ['#22b4ff', '#bfeaff'], track: '#f4fbff', edge: '#c8e9ff', speed: 9.5 },
  { name: 'Candy Works', sky: ['#ff6fb1', '#ffe0ef'], track: '#fff6fb', edge: '#ffc6e2', speed: 10.3 },
  { name: 'Storm Peaks', sky: ['#4b4ad8', '#c9c6ff'], track: '#eef0ff', edge: '#b9b8f2', speed: 11 },
];

export const LEVELS = [
  // ------------------------------------------------------------------ World 1 · Jelly Park
  { n: 'First Stretch', easy: 1, p: 'L1: only blue gates, can\'t lose, a big climb in ~15 s', rows: [
    G('h+20', 'w+20'), G('w+30', 'h+30'), G('h+40', 'w+40'), G('w+40', 'h+40'), G('h+50', 'w+50')] },
  { n: 'Pick Blue', easy: 1, p: 'L2: one tiny decision per gate: blue grows, red shrinks', rows: [
    G('h+30', 'h-20'), G('w-20', 'w+30'), G('h+40', 'w-20'), G('w-30', 'w+40'), G('h+40', 'h-30'), G('h-30', 'w+40'), G('h+50', 'w-20'), G('w-20', 'h+50')] },
  { n: 'Duck!', p: 'L3: beams slice height: growing tall before a beam is wasted; first level you can lose', rows: [
    G('h+40', 'w+30'), B(1.5), G('w+30', 'h+50'), B(1.3), G('h-30', 'w-20'), B(1.0), G('h-30', 'w+40'), G('w+30', 'h+30'), B(2.2), B(1.8), G('w+40', 'h+50'), G('h+50', 'w+30')] },
  { n: 'Wide Before Low', p: 'practise beams: read the beam ahead, pick the axis it can\'t cut', rows: [
    G('h+40', 'w-20'), B(1.4), G('w+40', 'h+60'), B(1.2), G('h+60', 'h-30'), B(2.6), G('w+20', 'h+50'), B(1.5), G('h-20', 'w+40'), G('h+60', 'w+30'), B(1.3), D(L, 8, 'w'), G('w+30', 'h+30'), G('h+40', 'w+40')] },
  { n: 'Mind the Wall', easy: 1, p: 'introduce walls: steer into the hole; missing it crushes you', rows: [
    G('h+30', 'w+30'), W(0, 3.2), G('w+30', 'h+30'), W(L, 2.8), G('h+40', 'w+20'), W(Rr, 2.8), G('w+20', 'h+40'), W(-0.8, 2.6), W(0, 2.4), G('h+40', 'w+30'), W(L, 2.2), D(Rr, 8, 'h'), G('h+40', 'w+40')] },
  { n: 'Squeeze', p: 'narrow holes squeeze width: grow tall before a narrow wall', rows: [
    G('w+50', 'h+30'), W(0, 1.0), G('h+40', 'w+60'), W(L, 0.9), G('w+40', 'h+40'), W(Rr, 1.2), G('h-20', 'w-30'), W(0.6, 1.1), G('w+60', 'h+40'), W(Rr, 1.0), D(L, 8, 'h'), W(-0.8, 1.2), G('h+50', 'w+50')] },
  { n: 'Jelly Drops', easy: 1, p: 'introduce drops: a line of pickups on one side, a gate on the other', rows: [
    G('h+30', 'w+30'), D(L, 6, 'h'), G('w+20', null), D(Rr, 8, 'w'), G(null, 'h+30'), B(1.8), D(0, 8, 'w'), G('w+30', 'h+30'), W(0, 1.4), D(Rr, 8, 'h'), G('w+40', null), B(1.6), D(L, 8, 'w'), G('h+40', 'w+40')] },
  { n: 'Read Ahead', p: 'twist: beam then wall back to back; balance height and width', rows: [
    G('h+50', 'w+30'), B(1.6), W(L, 1.1), G('w+60', 'h+40'), D(Rr, 8, 'h'), B(2.0), G('h+30', 'w-20'), W(Rr, 1.0), G('h+60', 'w+40'), B(1.4), D(L, 8, 'w'), G('w+30', 'h-30'), W(0, 1.1), G('h+60', 'w-30'), B(1.5), D(Rr, 8, 'w'), G('h+40', 'w+40')] },
  { n: 'Jelly Gauntlet', hard: 1, p: 'HARD: dense beams and walls, red on both sides, pick the lesser cut', rows: [
    G('h+50', 'w+30'), B(1.3), G('w+40', 'h+20'), W(L, 1.0), G('h+50', 'w+30'), B(1.4), W(Rr, 1.1), G('h-20', 'w-30'), D(0, 8, 'h'), B(1.6), G('w+50', 'h+30'), W(0, 1.0), G('h+60', 'w+40'), B(1.5), G('w+50', 'h+40'), W(L, 0.9), G('h+50', 'w+30'), B(1.4), D(Rr, 8, 'w'), G('h+50', 'w+50')] },
  { n: 'Big Jelly', p: 'first big test: every gate has a cost, a beam and a door make you pick a shape', rows: [
    G('h+50', 'w-20'), D(L, 8, 'h'), G('w-30', 'h+50'), B(2.2), D(Rr, 8, 'w'), G('h+40', 'w-20'), W(L, 1.4), G('w+60', 'h-30'), B(2.6), D(L, 10, 'w'), G('h-30', 'w+60'), Dr([[L, 1.0, 3.3], [Rr, 2.5, 1.5]]), D(Rr, 10, 'h'), G('h+50', 'w+50')] },

  // ------------------------------------------------------------------ World 2 · Candy Works
  { n: 'Double Up', easy: 1, p: 'introduce ×2: doubling is worth more the bigger you already are', rows: [
    G('h+30', 'w+30'), G('w+20', 'h+20'), G('hx2', 'w+40'), B(2.6), G('w+30', 'wx2'), W(0, 2.4), G('h+30', 'wx2'), B(1.8), D(L, 8, 'h'), G('hx2', 'w+40'), W(Rr, 2.0), G('h+40', 'w+40')] },
  { n: 'Golden Drop', easy: 1, p: 'introduce the golden drop: it sits behind the riskier choice', rows: [
    G('h+30', 'w+30'), G('wx2', 'h-20', { gold: L }), B(1.6), G('h+40', 'w+30'), W(Rr, 1.4), G('hx2', 'w+40'), B(2.8), D(L, 8, 'w'), G('h+40', 'wx2'), W(0, 1.3), G('hx2', 'w+30'), B(2.0), G('w+40', 'h+40')] },
  { n: 'Catch It', easy: 1, p: 'introduce the sliding gate: one ×2 moving across, catch it', rows: [
    G('h+30', 'w+30'), S('wx2', 2.2, 0.45), G('h+40', 'w+20'), S('hx2', 2.2, 0.5), B(2.4), G('w+30', 'h+30', { gold: Rr }), S('wx2', 2.4, 0.6), S('hx2', 2.4, 0.55), B(2.0), D(Rr, 8, 'w'), S('wx2', 2.2, 0.6), W(L, 1.5), G('h+40', 'w+40')] },
  { n: 'Halving', p: 'practise ÷2: the halving gate hides next to the growing one; one beam turns ×2 into waste', rows: [
    G('hx2', 'w/2'), B(1.5), G('w+40', 'h/2'), G('wx2', 'h+30'), W(L, 1.2, 0, 0.5, { gold: L }), G('h/2', 'w+40'), D(Rr, 8, 'h'), G('hx2', 'wx2'), B(2.0), G('w/2', 'hx2'), W(0, 1.2), D(L, 8, 'w'), G('h/2', 'wx2'), B(1.6, 1), G('w+40', 'h+40')] },
  { n: 'Half Beam', p: 'introduce half beams: a beam over one side; go round it or take the cut for the gate below', rows: [
    G('h+40', 'w+30'), B(1.2, -1), G('h+30', 'w+30'), B(1.2, 1), G('hx2', 'w+30', { gold: L }), B(1.6, -1), G('w+40', 'h+40'), B(1.4, 1), G('h+40', 'wx2'), B(1.3, -1), G('hx2', 'w+40'), B(1.5, 1), D(L, 8, 'w'), W(0, 1.6), G('w+30', 'h+30')] },
  { n: 'Sugar Rush', p: 'mix: sliding gates between walls, drops on the far side', rows: [
    G('h+30', 'w+30'), S('hx2', 2.2, 0.55), B(2.0), G('w+60', 'h+40'), W(Rr, 1.1), D(L, 8, 'w'), G('h+60', 'w+40'), B(1.6), G('w+60', 'h+40'), W(L, 1.1), S('hx2', 2.4, 0.6, { gold: Rr }), B(1.8, 1), G('wx2', 'h+40'), D(Rr, 8, 'h'), W(0, 1.3), S('wx2', 2.2, 0.6), G('h+40', 'w+40')] },
  { n: 'Lesser Evil', p: 'twist: red ÷ on both sides, the half beam decides which side hurts less', rows: [
    G('h+40', 'w+40'), G('hx2', 'wx2'), B(1.8, 1), G('h/2', 'w/2'), W(0, 1.2), G('w+40', 'h+40', { gold: Rr }), B(1.3, -1), G('w/2', 'h/2'), G('hx2', 'w+50'), B(2.4), G('h/2', 'w+30'), W(L, 1.1), G('wx2', 'h/2'), B(1.4, 1), D(Rr, 8, 'w'), G('w+40', 'h+40')] },
  { n: 'Candy Press', p: '×2 behind narrow walls: double the axis the wall will not squeeze', rows: [
    G('h+40', 'w+40'), G('wx2', 'hx2'), W(L, 1.0), G('w+30', 'h+30'), S('hx2', 2.4, 0.6), B(1.6, -1), W(Rr, 1.1, 0, 0.5, { gold: Rr }), G('wx2', 'h+40'), D(L, 8, 'h'), W(0, 1.4), S('wx2', 2.4, 0.6), W(L, 1.2), G('h+40', 'wx2'), B(1.7, 1), D(Rr, 8, 'w'), G('h+40', 'w+40')] },
  { n: 'Candy Crusher', hard: 1, p: 'HARD: ÷ traps, half beams, sliding ×2, narrow walls in a row', rows: [
    G('h+40', 'w+30'), G('w/2', 'hx2'), B(1.5, 1), W(L, 1.0), G('wx2', 'h/2', { gold: L }), S('hx2', 2.6, 0.7), B(1.7), W(Rr, 0.9), G('h/2', 'w+40'), B(1.3, -1), G('wx2', 'w/2'), W(0, 1.1), G('h+40', 'w+40'), D(Rr, 8, 'h'), W(Rr, 1.0), G('h/2', 'wx2'), B(1.4, 1), S('hx2', 2.6, 0.75), W(L, 1.2), G('hx2', 'w+40')] },
  { n: 'Sweet Tooth', p: 'finale of world 2: doubles come with a catch, beams and a narrow hole punish greed', rows: [
    G('h+40', 'w-30'), G('wx2', 'h-30'), D(L, 10, 'h'), B(1.8), G('hx2', 'w-30', { gold: Rr }), D(Rr, 10, 'w'), G('hx2', 'w+30'), B(1.4), S('wx2', 2.2, 0.45), B(2.2), G('h-30', 'w+40'), D(L, 10, 'h'), S('hx2', 2.2, 0.5), W(0, 1.5), G('h+50', 'w-30'), Dr([[L, 1.4, 3.3], [Rr, 2.8, 2.2]]), G('w+50', 'h+50')] },

  // ------------------------------------------------------------------ World 3 · Storm Peaks
  { n: 'Moving Hole', easy: 1, p: 'introduce sliding walls: follow the hole', rows: [
    G('h+30', 'w+30'), W(0, 2.4, 1.6, 0.35), G('w+30', 'h+30'), W(0, 2.0, 2.0, 0.4), G('hx2', 'w+40', { gold: L }), B(2.6), W(0, 1.8, 2.0, 0.45), D(L, 8, 'h'), W(0, 1.6, 2.0, 0.5), G('wx2', 'h+40'), B(2.2), W(0, 1.5, 2.1, 0.5), G('w+40', 'h+40')] },
  { n: 'Drift', p: 'practise sliding walls with gate choices before them', rows: [
    G('w+40', 'h+40'), W(0, 1.2, 1.8, 0.4), G('h+40', 'wx2'), B(1.8), W(0, 1.6, 2.0, 0.5, { gold: Rr }), G('hx2', 'w+40'), B(1.7), D(L, 8, 'w'), W(0, 2.4, 2.0, 0.5), W(0, 1.3, 2.1, 0.55), G('w+40', 'hx2'), D(Rr, 8, 'h'), B(1.9), G('w+40', 'h+30'), G('h+40', 'w+40')] },
  { n: 'Shape Door', easy: 1, p: 'introduce shape doors: a tall-thin hole and a short-wide hole; your shape picks', rows: [
    G('h+40', 'w+40'), Dr([[L, 1.1, 3.2], [Rr, 2.6, 1.3]]), G('hx2', 'w+40'), Dr([[L, 2.6, 1.4], [Rr, 1.0, 3.4]]), G('wx2', 'h+40', { gold: L }), Dr([[L, 1.2, 3.0], [Rr, 2.4, 1.6]]), G('w+40', 'hx2'), Dr([[L, 2.4, 1.6], [Rr, 1.1, 3.2]]), D(Rr, 8, 'w'), G('h+40', 'wx2'), Dr([[L, 1.0, 3.4], [Rr, 2.6, 1.3]]), G('h+40', 'w+40')] },
  { n: 'Tailor Made', p: 'practise doors after × gates: grow the axis your door keeps', rows: [
    G('hx2', 'wx2'), Dr([[L, 0.9, 3.6], [Rr, 2.8, 1.1]]), G('w+40', 'h+40'), B(2.0, -1), G('hx2', 'w/2', { gold: Rr }), Dr([[L, 2.6, 1.2], [Rr, 1.1, 3.4]]), D(L, 8, 'w'), G('wx2', 'h+30'), Dr([[L, 1.0, 3.0], [Rr, 2.2, 1.6]]), G('hx2', 'w+40'), Dr([[L, 1.1, 3.2], [Rr, 2.5, 1.4]]), B(1.8, 1), G('w/2', 'wx2'), Dr([[L, 2.5, 1.3], [Rr, 1.0, 3.5]]), G('h+40', 'w+40')] },
  { n: 'Shifting Doors', p: 'twist: a sliding wall then a door: line up fast', rows: [
    G('h+40', 'w+40'), W(0, 1.4, 2.0, 0.5), Dr([[L, 1.1, 3.2], [Rr, 2.4, 1.4]]), G('wx2', 'hx2'), S('hx2', 2.4, 0.6, { gold: L }), W(0, 1.6, 2.2, 0.55), Dr([[L, 2.4, 1.6], [Rr, 1.2, 3.0]]), G('w+40', 'hx2'), W(0, 1.3, 2.2, 0.55), Dr([[L, 1.0, 3.4], [Rr, 2.6, 1.3]]), D(L, 8, 'h'), G('wx2', 'h+40'), W(0, 1.5, 2.0, 0.6), G('h+40', 'w+40')] },
  { n: 'Windy', easy: 1, p: 'introduce wind belts: they push you sideways; hold your line through the gems', rows: [
    G('h+30', 'w+30'), F(2.2), G('w+40', 'h+40'), F(-2.4), W(0, 1.8), G('hx2', 'w+40', { gold: Rr }), F(2.6), D(L, 8, 'h'), F(-2.6), G('hx2', 'w+30'), B(1.8), F(2.8), W(Rr, 1.5), D(L, 8, 'w'), G('w+40', 'h+40')] },
  { n: 'Crosswind', p: 'wind pushes you off the hole: steer against it', rows: [
    G('w+40', 'h+40'), F(-2.6), W(Rr, 1.4), G('hx2', 'w+30'), F(2.8), W(L, 1.3, 0, 0.5, { gold: L }), B(1.8), G('wx2', 'h+40'), F(-2.8), W(0, 1.2, 1.6, 0.45), G('h+40', 'wx2'), F(2.8), Dr([[L, 1.0, 3.4], [Rr, 2.5, 1.4]]), D(Rr, 8, 'h'), F(-2.6), B(1.7), G('h+40', 'w+40')] },
  { n: 'Storm Front', p: 'everything: wind into a door, ×2 then ÷2, half beams', rows: [
    G('h+40', 'w+40'), F(2.6), Dr([[L, 1.0, 3.4], [Rr, 2.6, 1.3]]), G('h/2', 'hx2'), B(1.6, 1), G('wx2', 'w+40', { gold: Rr }), F(-2.8), W(0, 1.3, 2.0, 0.5), G('hx2', 'w/2'), Dr([[L, 2.4, 1.6], [Rr, 1.1, 3.2]]), F(-2.6), W(0, 1.2, 2.2, 0.55), G('h/2', 'wx2'), B(1.5, -1), D(L, 8, 'h'), G('h+40', 'w+40')] },
  { n: 'Summit', hard: 1, p: 'HARD: sliding holes, doors, wind and ÷ traps back to back', rows: [
    G('h+40', 'w+40'), W(0, 1.2, 2.2, 0.55), G('w/2', 'hx2'), F(-2.8), Dr([[L, 1.0, 3.6], [Rr, 2.6, 1.2]]), S('wx2', 2.6, 0.7, { gold: Rr }), B(1.5, -1), W(0, 1.1, 2.2, 0.6), G('h/2', 'wx2'), F(3.0), Dr([[L, 1.0, 3.4], [Rr, 2.6, 1.3]]), G('hx2', 'w+50'), B(1.8), F(2.8), W(0, 1.2, 2.2, 0.6), G('w/2', 'hx2'), Dr([[L, 2.6, 1.2], [Rr, 1.0, 3.6]]), D(Rr, 8, 'w'), G('h+40', 'w+40')] },
  { n: 'Storm King', p: 'final test: wind, sliding hole, doors and beams; read each shape, greedy and random both fail', rows: [
    G('hx2', 'w-30'), D(L, 10, 'h'), G('wx2', 'h-30', { gold: L }), F(2.4), W(L, 1.3), D(Rr, 10, 'w'), S('hx2', 2.2, 0.45), B(2.0), G('h-30', 'wx2'), F(-2.4), D(L, 10, 'w'), W(0, 1.3, 1.6, 0.4), Dr([[L, 1.0, 3.3], [Rr, 2.5, 1.4]]), G('wx2', 'h-30'), B(1.6), G('h+60', 'w+60')] },
];

// stars [2★ step, 3★ step]: from qa/solve.cjs (3★ = the best plan's step - 1, 2★: a random-choice player gets it on ≤25% of runs, qa/restar.cjs, qa/lazy.cjs)
export const STARS = [[7,12], [12,20], [9,11], [9,12], [17,18], [13,15], [9,10], [5,6], [6,7], [11,18], [20,21], [9,10], [9,10], [12,20], [12,20], [20,21], [11,19], [19,21], [12,20], [12,14], [10,11], [12,13], [9,12], [7,11], [14,18], [9,10], [8,13], [12,20], [8,13], [10,15]];
export const worldOf = lv => Math.min(2, Math.floor((lv - 1) / 10));

// ------------------------------------------------------------------ rules (the game and qa/solve.cjs both use these)
export function parseGate(s) {
  if (!s) return null;
  const ax = s[0], op = s[1], v = +s.slice(2);
  return { ax, op, v: op === '+' || op === '-' ? v / 100 : v, good: op === '+' || op === 'x', label: (ax === 'h' ? (op === '+' || op === 'x' ? 'Taller' : 'Shorter') : (op === '+' || op === 'x' ? 'Wider' : 'Thinner')), big: op === 'x' ? '×' + v : op === '/' ? '÷' + v : op + v };
}
export function gateApply(P, g) {
  const k = g.ax === 'h' ? 'H' : 'W', max = g.ax === 'h' ? MAX_H : MAX_W;
  let v = P[k];
  if (g.op === '+') v += g.v; else if (g.op === '-') v -= g.v; else if (g.op === 'x') v *= g.v; else v /= g.v;
  P[k] = Math.max(0.05, Math.min(max, v));
}
export const capH = h => (h - 0.06) / BASE_H;          // height a beam/door of h metres leaves
export const capW = w => (w * 0.92) / BASE_W;          // width a hole of w metres leaves
export const crashCost = world => [0.5, 0.55, 0.6][world];
export const mass = P => P.H * P.W;
export const dead = P => P.H < MIN_H || P.W < MIN_W;
/** steps climbed with this body (0 = too small to climb) */
export function stepsFor(m) { let n = 0; while (n < STEPS && m - STEP_COST >= MIN_H * 0.6) { const f = Math.sqrt(Math.max(0.01, (m - STEP_COST) / m)); m = m * f * f; n++; } return n; }
export const multOf = step => +(1 + (step - 1) * 0.2).toFixed(1);   // step 1 = x1.0 … step 21 = x5.0

// levels past 30: mixed from every unlocked row type, same sawtooth (hard every 10th); seeded by level number
export function genLevel(lv, R) {
  const pick = a => a[Math.floor(R() * a.length)], gate = () => pick(['h+30', 'w+30', 'h+40', 'w+40', 'hx2', 'wx2', 'h-20', 'w-20', 'h/2', 'w/2']);
  const n = 10 + (lv % 10) + (lv % 10 === 9 ? 3 : 0), rows = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) { let a = gate(), b = gate(); if (!parseGate(a).good && !parseGate(b).good) a = pick(['h+40', 'w+40']); rows.push(G(a, b)); continue; }
    const t = pick(['b', 'b', 'w', 'w', 'r', 'd', 'f', 's', 'bh']);
    if (t === 'b') rows.push(B(1.3 + R() * 1.4));
    else if (t === 'bh') rows.push(B(1.2 + R() * 0.6, R() < 0.5 ? -1 : 1));
    else if (t === 'w') rows.push(W(R() < 0.5 ? 0 : pick([L, Rr]), 1.0 + R() * 0.9, R() < 0.5 ? 1.8 : 0, 0.45 + R() * 0.2));
    else if (t === 'r') rows.push(Dr(R() < 0.5 ? [[L, 1.0, 3.3], [Rr, 2.5, 1.3]] : [[L, 2.5, 1.4], [Rr, 1.1, 3.2]]));
    else if (t === 'd') rows.push(D(pick([L, 0, Rr]), 8, R() < 0.5 ? 'h' : 'w'));
    else if (t === 'f') rows.push(F((R() < 0.5 ? -1 : 1) * (2.2 + R() * 0.8)));
    else rows.push(S(pick(['hx2', 'wx2']), 2.2 + R() * 0.4, 0.45 + R() * 0.25));
  }
  rows.push(G('h+40', 'w+40'));
  return { n: 'Bonus Run ' + (lv - 30), p: 'generated', rows, hard: lv % 10 === 9 ? 1 : 0, gen: 1 };
}

/** perfect play for a level: { best: steps on the stairs, plan: choice index per row (null = no choice) }.
 *  Choices: gate side 0/1 · slider 0 catch / 1 skip · half beam 0 under / 1 round · door hole i · drops 0 take / 1 skip */
export function bestPlan(rows) {
  let best = -1, plan = null; const cur = [];
  const opts = r => {
    if (r.k === 'g') return [r.a, r.b].map(s => s ? (P => gateApply(P, parseGate(s))) : (() => {}));
    if (r.k === 's') return [P => gateApply(P, parseGate(r.a)), () => {}];
    if (r.k === 'b' && r.side) return [P => { P.H = Math.min(P.H, capH(r.h)); }, () => {}];
    if (r.k === 'r') return r.holes.map(([, hw, hh]) => P => { P.W = Math.min(P.W, capW(hw)); P.H = Math.min(P.H, capH(hh)); });
    if (r.k === 'd') return [P => { P[r.ax === 'h' ? 'H' : 'W'] += r.n * 0.04; }, () => {}];
    return null;
  };
  const go = (j, P) => {
    if (dead(P)) return;
    if (j === rows.length) { const s = stepsFor(mass(P)); if (s > best) { best = s; plan = cur.slice(); } return; }
    const r = rows[j], o = opts(r);
    if (!o) { const Q = { ...P }; if (r.k === 'b') Q.H = Math.min(Q.H, capH(r.h)); if (r.k === 'w') Q.W = Math.min(Q.W, capW(r.w)); cur.push(null); go(j + 1, Q); cur.pop(); return; }
    o.forEach((f, k) => { const Q = { ...P }; f(Q); cur.push(k); go(j + 1, Q); cur.pop(); });
  };
  go(0, { H: 1, W: 1 });
  return { best, plan };
}
export const starsFor = (lv, rows) => { if (lv <= LEVELS.length) return STARS[lv - 1]; const b = Math.max(2, bestPlan(rows).best - 1); return [Math.max(2, Math.round(b * 0.6)), b]; };

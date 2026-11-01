// Smash Dummy v2 — 30 authored levels in 3 worlds. k = setpieces left to right [name, options]; thr = throws; g = damage for 1/2/3 stars
// (calibrated by qa/calib.cjs: 35th / 70th / 93rd percentile of 60 simulated aimed rounds, rounded to 5).
export const WORLDS = [
  { name: 'TEST YARD', sky: ['#8fd3ff', '#e6f7ff'], fog: '#bfe6fb', ground: '#9be0b4', hemi: '#6fb88d', ui: '#ff8a1f', sub: '#5b7088' },
  { name: 'FACTORY', sky: ['#f6d9bb', '#fff3e3'], fog: '#f3d9bd', ground: '#f1e0cb', hemi: '#d9bd9c', ui: '#e8530e', sub: '#7a5a3c' },
  { name: 'FUNFAIR', sky: ['#f7c9e6', '#fff0fa'], fog: '#f5c9e4', ground: '#fbe0f1', hemi: '#d9a6c8', ui: '#d92f86', sub: '#8a4a73' },
];
const L = (w, k, thr, why, g = [60, 110, 160]) => ({ w, k, thr, why, g });
export const LEVELS = [
  // ---- world 1: test yard
  L(0, [['ball', { spd: 1.0, amp: 0.9 }]], 3, 'Flick the dummy into one slow ball', [50, 100, 150]),
  L(0, [['stairs']], 3, 'Gravity does the work: tumble down the stairs'),
  L(0, [['car']], 3, 'Timing: let the car come to you'),
  L(0, [['paddles', { n: 1 }]], 3, 'One paddle: choose your moment'),
  L(0, [['bumpers']], 3, 'Pinball: every pop feeds the combo'),
  L(0, [['crate']], 3, 'Walk under the crate and let it drop'),
  L(0, [['stairs'], ['ball']], 3, 'Fall down the stairs into the ball'),
  L(0, [['ball', { spd: 1.1 }], ['gold', { y: 3.2 }]], 3, 'NEW: the golden target pays big'),
  L(0, [['glass'], ['paddles', { n: 2 }]], 3, 'NEW: glass shatters, then the paddles'),
  L(0, [['ball', { n: 2 }], ['car']], 3, 'BOSS: two balls and a car'),
  // ---- world 2: factory
  L(1, [['tnt', { n: 1 }]], 3, 'NEW: TNT. Touch it and it blows'),
  L(1, [['glass', { n: 2 }], ['paddles', { n: 1 }]], 3, 'Two panes, one paddle'),
  L(1, [['spikes'], ['bumpers']], 3, 'NEW: spikes bite double. Land on them'),
  L(1, [['fan'], ['ball', { spd: 1.3 }]], 3, 'NEW: the updraft fan. Float into the ball'),
  L(1, [['tnt', { n: 2 }], ['crate']], 3, 'Chain boom: the second barrel goes too'),
  L(1, [['stairs'], ['tnt', { n: 2 }]], 3, 'Top of the tower, bomb at the bottom'),
  L(1, [['car', { period: 2.2 }], ['spikes']], 3, 'Fast car, spiky landing'),
  L(1, [['glass', { n: 3 }], ['gold', { y: 2.4 }]], 3, 'Three panes and a golden prize'),
  L(1, [['paddles', { n: 3 }], ['fan']], 3, 'Three paddles and a lift'),
  L(1, [['tnt', { n: 3 }], ['car'], ['ball', { n: 2 }]], 3, 'BOSS: the whole factory floor'),
  // ---- world 3: funfair
  L(2, [['bumpers'], ['fan']], 3, 'Bump, float, bump again'),
  L(2, [['stairs'], ['car', { period: 2.2 }]], 3, 'Tower into traffic'),
  L(2, [['gold', { y: 4.2, bob: 1 }], ['paddles', { n: 2 }]], 3, 'The gold bobs. Chase it'),
  L(2, [['ball', { n: 2, spd: 1.4 }]], 2, 'TWO THROWS: fast double ball'),
  L(2, [['tnt', { n: 2 }], ['glass', { n: 2 }], ['spikes']], 3, 'Boom, crash, spikes'),
  L(2, [['fan'], ['bumpers'], ['gold', { y: 3.6 }]], 3, 'Float over the bumpers for the gold'),
  L(2, [['stairs'], ['tnt', { n: 2 }], ['car']], 2, 'TWO THROWS: stairs, bombs, traffic'),
  L(2, [['spikes'], ['paddles', { n: 3 }], ['ball', { spd: 1.3 }]], 3, 'Spikes, paddles, ball: stay alive'),
  L(2, [['glass', { n: 2 }], ['tnt', { n: 2 }], ['bumpers']], 3, 'Everything breaks eventually'),
  L(2, [['ball', { n: 2, spd: 1.3 }], ['paddles', { n: 2 }], ['tnt', { n: 2 }]], 4, 'FINAL BOSS: four throws, no mercy'),
];

// star targets: 22% / 45% / 70% of what a greedy best-of-40 search reaches (qa/expert.mjs, deterministic rollouts); early levels capped lower
const GOALS = [[70, 255, 395], [80, 170, 265], [90, 275, 430], [100, 220, 340], [95, 190, 300], [130, 265, 410], [115, 235, 365], [80, 165, 255], [100, 205, 315], [180, 365, 570], [65, 135, 205], [85, 170, 270], [110, 225, 345], [115, 230, 360], [125, 260, 400], [125, 255, 400], [140, 280, 440], [60, 125, 200], [110, 225, 350], [120, 245, 380], [100, 205, 320], [95, 190, 300], [115, 235, 365], [105, 210, 330], [185, 380, 595], [115, 240, 370], [70, 150, 230], [85, 175, 275], [90, 185, 290], [140, 285, 440]];
// cycle 13: critic #5 cleared all 30 in 8 min with a random flicker -> targets raised (1 star x1.2 from L4, 2 star x1.45, 3 star x1.7 from L4)
LEVELS.forEach((l, i) => { const k = i < 3 ? [1, 1.15, 1.3] : [1.2, 1.45, 1.7]; l.g = GOALS[i].map((v, j) => Math.round(v * k[j] / 5) * 5); });

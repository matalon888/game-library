// Swirl Tee v2: hand-made orders. Colours: 0 blue, 1 yellow, 2 pink, 3 green, 4 purple, 5 red, 6 sky, 7 orange.
// fold: spiral | rings | stripes | burst | diag | heart. cols = target colour per section (spiral/burst: around the clock
// from the left; rings: centre out; stripes/diag: bundle left to right = shirt top to bottom). btns = bottles on the table.
// folds = fold buttons shown. thr = match needed (scaled by flow.k like v1 from level 3). par = seconds for the 3rd star.
// mix = only primaries (red 5, yellow 1, blue 0) mix: 0+1 = 3 green, 1+5 = 7 orange, 0+5 = 4 purple, a third = mud.
// hint = mix dots show their two drops. wet = dye bleeds over a string when you stroke near it. bonus = free-dye shirt.
const A = ['spiral', 'rings', 'stripes'], B = ['spiral', 'rings', 'stripes', 'burst'], C = ['stripes', 'diag', 'rings', 'burst'];
const D = ['spiral', 'burst', 'rings', 'heart'], E = ['stripes', 'diag', 'heart', 'spiral'];
export const WORLDS = [
  { name: 'Beach Stall', from: 1, bg: '#ffd02e' },
  { name: 'Night Market', from: 13, bg: '#8f7bff' },
  { name: 'Festival', from: 25, bg: '#ff7eb6' },
];
export const LEVELS = [
  // ---- World 1: Beach Stall (read the target, four folds)
  { why: 'intro: one fold button, two fat stripes, bottle picks itself; can\'t lose', fold: 'stripes', N: 2, cols: [2, 6], btns: [2, 6], folds: ['stripes'], thr: 0.6, par: 12, brush: 0.62, guide: true, cust: '🧒' },
  { why: 'first choice: rings or spiral, the target says rings', fold: 'rings', N: 2, cols: [1, 4], btns: [1, 4, 3], folds: ['rings', 'spiral'], thr: 0.65, par: 12, brush: 0.46, guide: true, cust: '👩‍🦰' },
  { why: 'first loseable order: three folds, three-wedge spiral, pick each colour yourself', fold: 'spiral', N: 3, cols: [5, 1, 0], btns: [5, 1, 0], folds: A, thr: 0.7, par: 14, brush: 0.36, cust: '🧑‍🎤' },
  { why: 'practise: three stripes, one decoy bottle', fold: 'stripes', N: 3, cols: [7, 2, 4], btns: [4, 7, 3, 2], folds: A, thr: 0.72, par: 13, brush: 0.34, cust: '👵' },
  { why: 'practise: three rings, colours repeat (inside = outside)', fold: 'rings', N: 3, cols: [6, 1, 6], btns: [1, 6, 5], folds: A, thr: 0.72, par: 13, brush: 0.33, cust: '🧔' },
  { why: 'bonus: free dye, no target, any fold, a keeper for the wall', fold: 'spiral', N: 5, cols: [5, 1, 3, 0, 4], btns: [5, 1, 3, 0, 4, 2], folds: A, thr: 0, par: 99, brush: 0.36, bonus: true, cust: '🐶' },
  { why: 'new fold BURST: straight sunburst; only spiral and burst shown so the difference is the lesson', fold: 'burst', N: 4, cols: [2, 1, 2, 1], btns: [2, 1], folds: ['spiral', 'burst'], thr: 0.7, par: 13, brush: 0.36, cust: '👧', isNew: 'burst' },
  { why: 'practise: spiral vs burst with all four folds shown', fold: 'spiral', N: 4, cols: [0, 3, 1, 3], btns: [3, 1, 0, 6], folds: B, thr: 0.74, par: 14, brush: 0.32, cust: '🧑‍🍳' },
  { why: 'practise: five-wedge burst, two decoys', fold: 'burst', N: 5, cols: [5, 7, 1, 6, 4], btns: [4, 6, 5, 2, 7, 1], folds: B, thr: 0.75, par: 17, brush: 0.32, cust: '👨‍🎨' },
  { why: 'HARD: six-wedge spiral, five colours, thin wedges at the centre', fold: 'spiral', N: 6, cols: [2, 0, 1, 3, 4, 0], btns: [3, 0, 2, 4, 1, 6], folds: B, thr: 0.78, par: 21, brush: 0.29, hard: true, cust: '🦸' },
  { why: 'breather: two fat rings, flashy colours', fold: 'rings', N: 2, cols: [7, 2], btns: [2, 7], folds: B, thr: 0.7, par: 9, brush: 0.44, cust: '🐱' },
  { why: 'world finale: five-stripe sunset', fold: 'stripes', N: 5, cols: [1, 7, 5, 2, 4], btns: [5, 4, 1, 2, 7, 0], folds: B, thr: 0.77, par: 19, brush: 0.3, cust: '🤠' },
  // ---- World 2: Night Market (mixing, diagonal fold, mud)
  { why: 'intro mixing: only yellow and blue, the bottom stripe is green (dot shows blue + yellow)', fold: 'stripes', N: 2, cols: [1, 3], btns: [1, 0], folds: ['stripes', 'rings'], thr: 0.65, par: 14, brush: 0.5, mix: true, hint: true, cust: '🧑‍🚀', isNew: 'mix' },
  { why: 'practise: orange from red + yellow in a ring', fold: 'rings', N: 3, cols: [5, 7, 1], btns: [5, 1, 0], folds: A, thr: 0.7, par: 16, brush: 0.36, mix: true, hint: true, cust: '👨‍🌾' },
  { why: 'practise: purple wedges; the blue bottle is next to red, a third colour makes mud', fold: 'spiral', N: 4, cols: [4, 1, 4, 0], btns: [0, 5, 1], folds: A, thr: 0.72, par: 18, brush: 0.34, mix: true, hint: true, cust: '🧙' },
  { why: 'new fold DIAGONAL: stripes on a slant; stripes vs diagonal is the lesson, no mixing', fold: 'diag', N: 3, cols: [6, 2, 1], btns: [1, 6, 2], folds: ['stripes', 'diag'], thr: 0.72, par: 13, brush: 0.36, cust: '👩‍🎤', isNew: 'diag' },
  { why: 'twist: diagonal with one green to mix', fold: 'diag', N: 4, cols: [0, 3, 1, 5], btns: [5, 0, 1], folds: C, thr: 0.74, par: 19, brush: 0.33, mix: true, hint: true, cust: '🧕' },
  { why: 'bonus: free dye with the three primaries, mix anything', fold: 'rings', N: 4, cols: [5, 7, 1, 3], btns: [5, 1, 0], folds: C, thr: 0, par: 99, brush: 0.36, bonus: true, mix: true, cust: '🦊' },
  { why: 'read it yourself: mix dots without the drops; six-wedge burst with two mixes', fold: 'burst', N: 6, cols: [5, 7, 1, 3, 0, 4], btns: [0, 1, 5], folds: C, thr: 0.74, par: 26, brush: 0.32, mix: true, cust: '🧑‍🎓' },
  { why: 'HARD: spiral of all three mixes, mud waiting for one slip', fold: 'spiral', N: 6, cols: [3, 1, 7, 5, 4, 0], btns: [1, 5, 0], folds: B, thr: 0.78, par: 27, brush: 0.3, mix: true, hard: true, cust: '🦹' },
  { why: 'breather: three rings, one easy mix', fold: 'rings', N: 3, cols: [0, 3, 1], btns: [1, 0], folds: C, thr: 0.7, par: 14, brush: 0.4, mix: true, cust: '🐼' },
  { why: 'practise: five diagonal stripes, two mixes, no drops shown', fold: 'diag', N: 5, cols: [4, 0, 3, 1, 7], btns: [5, 0, 1], folds: C, thr: 0.75, par: 24, brush: 0.32, mix: true, cust: '👨‍🔧' },
  { why: 'twist: four rings where every ring is a mix', fold: 'rings', N: 4, cols: [7, 4, 3, 7], btns: [0, 1, 5], folds: C, thr: 0.75, par: 36, brush: 0.32, mix: true, cust: '🧛' },
  { why: 'world finale: rainbow sunburst, red-orange-yellow-green-blue-purple', fold: 'burst', N: 6, cols: [5, 7, 1, 3, 0, 4], btns: [5, 1, 0], folds: ['spiral', 'burst', 'diag', 'rings'], thr: 0.78, par: 27, brush: 0.31, mix: true, hard: true, cust: '🦄' },
  // ---- World 3: Festival (heart fold, wet fabric)
  { why: 'new fold HEART: the surprise reveal; two rings, can\'t really miss', fold: 'heart', N: 2, cols: [2, 5], btns: [5, 2], folds: ['rings', 'heart'], thr: 0.68, par: 11, brush: 0.46, cust: '💃', isNew: 'heart' },
  { why: 'practise: three-ring heart with a decoy', fold: 'heart', N: 3, cols: [5, 2, 4], btns: [4, 2, 6, 5], folds: D, thr: 0.72, par: 14, brush: 0.36, cust: '🕺' },
  { why: 'new: WET fabric. Two wide stripes; stroke near the string and the dye bleeds over', fold: 'stripes', N: 2, cols: [6, 1], btns: [1, 6], folds: E, thr: 0.7, par: 13, brush: 0.4, wet: true, cust: '🧜', isNew: 'wet' },
  { why: 'practise: wet rings, the thin middle ring needs a careful hand', fold: 'rings', N: 3, cols: [2, 1, 0], btns: [0, 2, 1], folds: D, thr: 0.72, par: 17, brush: 0.32, wet: true, cust: '🧚' },
  { why: 'practise: wet four-wedge spiral', fold: 'spiral', N: 4, cols: [3, 2, 6, 2], btns: [6, 2, 3, 1], folds: D, thr: 0.74, par: 18, brush: 0.32, wet: true, cust: '🎅' },
  { why: 'bonus: free dye heart, all eight bottles', fold: 'heart', N: 4, cols: [5, 2, 4, 6], btns: [5, 2, 4, 6, 1, 3], folds: E, thr: 0, par: 99, brush: 0.36, bonus: true, cust: '🐸' },
  { why: 'twist: wet burst with decoys; wedges meet at the centre so start at the rim', fold: 'burst', N: 5, cols: [1, 5, 2, 6, 3], btns: [2, 4, 5, 6, 1, 3], folds: D, thr: 0.74, par: 24, brush: 0.3, wet: true, cust: '🧝' },
  { why: 'HARD: wet heart with two mixes', fold: 'heart', N: 4, cols: [5, 7, 1, 3], btns: [5, 1, 0], folds: E, thr: 0.76, par: 30, brush: 0.3, wet: true, mix: true, hard: true, cust: '🤴' },
  { why: 'breather: three fat diagonal stripes, dry', fold: 'diag', N: 3, cols: [2, 7, 1], btns: [7, 1, 2], folds: E, thr: 0.72, par: 14, brush: 0.4, cust: '🐨' },
  { why: 'practise: wet diagonal, mixes, no drops shown', fold: 'diag', N: 5, cols: [0, 4, 5, 7, 1], btns: [5, 1, 0], folds: E, thr: 0.75, par: 26, brush: 0.3, wet: true, mix: true, cust: '👩‍🚒' },
  { why: 'test: wet six-wedge spiral, five colours', fold: 'spiral', N: 6, cols: [6, 2, 1, 4, 3, 2], btns: [3, 2, 6, 4, 1, 0], folds: ['spiral', 'burst', 'rings', 'heart'], thr: 0.76, par: 26, brush: 0.29, wet: true, cust: '🧑‍✈️' },
  { why: 'FINALE HARD: rainbow heart, wet, every mix', fold: 'heart', N: 5, cols: [5, 7, 1, 3, 0], btns: [5, 1, 0], folds: ['spiral', 'burst', 'rings', 'heart'], thr: 0.78, par: 33, brush: 0.29, wet: true, mix: true, hard: true, cust: '👑' },
];
export const MIX = { '0,1': 3, '1,5': 7, '0,5': 4 };   // sorted pair of primaries -> secondary; anything else on a colour = mud (8)
export const MUD = 8;

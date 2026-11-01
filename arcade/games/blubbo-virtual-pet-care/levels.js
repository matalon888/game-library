// levels.js — Blubbo's Island: 30 trips in 3 worlds, authored by hand.
// A trip is one of three mini-games, built from hand-written PHRASES (short runs of rows, 7 lanes wide, '/' between rows).
//   hop   rows go bottom -> top.  o cloud  m moving cloud  c crumbly cloud  s spring cloud  g golden-star cloud  x storm cloud  . air
//   catch rows fall in order.     f snack  h heavy snack (fast, 2 pts)  g golden snack (3 pts)  b spike  m magnet snack  . empty
//   pop   rows rise in order.     o bubble  B big bubble (2 taps, 2 pts)  Z zig-zag bubble  G golden bubble (fast, 3 pts)  T thorn
// Every trip has three goals: 1 star = reach `goal` points (hop: reach the top), 2 stars = clean (no hit, no fall),
// 3 stars = collect `gold` golden things.  `gap` = frames between rows, `speed` = fall / rise speed (px per 16 ms frame).

export const WORLDS = [
  { name: 'Meadow Pond', icon: '🌿', col: '#9be7b0', sky: ['#9fe3ff', '#e6fbff'], hint: 'Pads, snacks and bubbles' },
  { name: 'Candy Canyon', icon: '🍭', col: '#ffb3d1', sky: ['#ffc2dc', '#fff0f6'], hint: 'Crumbly pads, heavy snacks, big bubbles' },
  { name: 'Cloud Kingdom', icon: '☁️', col: '#b9a8ff', sky: ['#a89cff', '#eae6ff'], hint: 'Storms, wind and everything at once' },
];

export const PH = {
  hop: {
    start: '...o.../.o...o./...o.../o.....o/...o...',
    zig: '.o...../...o.../.....o./...o.../.o.....',
    wide: 'o..o..o/..o.o../o..o..o/...o.../o.....o',
    sway: '..m..../.o...o./...m.../o.....m/..m.o..',
    glide: 'm....m./...o.../.m...m./...o.../m.....m',
    pearl: '...o.../.o...g./....o../.g..o../...o...',
    pearls: 'o...g../..o..../g...o../...o.g./.o.....',
    crumb: '..c.o../.c...o./..o.c../c.o..../..c.o..',
    crunch: 'c.c.c.c/.c.c.c./c.c.c.c/..o.o../c.....c',
    boing: 's....../......./......./......./..o.o.o',
    boing2: '...s.../......./......./......./o.o.o.o/..g....',
    chain: '.s...../......./......./......./...s.../......./......./......./o...o.o',
    bumpy: 'm.c.o.m/..s..../......./......./c.o.c.o/..m.m..',
    cloudA: '..x.o../.o...o./..o.x../x.o..../..o.x.o',
    cloudB: '.x...o./..o.o../o...x../.o...o./..x.o..',
    cloudC: 'x.o.o.x/.o...o./x..o..x/..o.o../x..o..x',
    squall: '..m.x../o...c.x/..s..../......./.x.o...',
    tower: 'o.m.c.o/.c.x.c./s....../......./.o.g.o./x..o..x',
  },
  catch: {
    solo: '...f...', left: 'f......', right: '......f', rest: '.......', pair: 'f.....f', trio: 'f..f..f',
    stairR: 'f....../.f...../..f..../...f.../....f../.....f./......f',
    stairL: '......f/.....f./....f../...f.../..f..../.f...../f......',
    wavy: '.f...../...f.../.....f./...f.../.f.....',
    fork: '..f.f../.f...f./f.....f',
    cluster: '.ff.ff./.......',
    spikeRow: 'b.....b/..b.b../.......',
    spikeGap: 'bb.f.bb/.......',
    spikeLane: '.b.f.b./...b.../.f...f.',
    pick: 'f..b..f/.......',
    goldL: 'g....../.......',
    goldR: '......g/.......',
    goldMid: '...g.../.......',
    goldRisk: 'b.g.b../..f.f../.......',
    heavy: '.h...../.......',
    heavyP: 'h.....h/...f.../.......',
    heavyRun: '.h...../...h.../.....h./...h.../.h.....',
    magnet: '...m.../.......',
    rain: 'f.f.f.f/.......',
    rainb: '.f.f.f./.......',
    storm: 'f.b.f.b/.b.f.b./b.f.b.f/.f.b.f.',
    dense: 'ff.b.ff/.......',
    hrun: 'h.h.h.h/.......',
  },
  pop: {
    solo: '...o...', left: 'o......', right: '......o', rest: '.......', pair: 'o.....o', trio: 'o..o..o',
    ladder: 'o....../.o...../..o..../...o.../....o../.....o./......o',
    ladderL: '......o/.....o./....o../...o.../..o..../.o...../o......',
    cloud: '.oo.oo./.......',
    dots: 'o.o.o.o/.......',
    dotsb: '.o.o.o./.......',
    thornPair: 'T.o.o.T/.......',
    thornRow: 'oT.o.To/..o.o../.......',
    thornGate: 'TTT.TTT/..o.o../.......',
    thornZig: 'o.T.o.T/.T.o.T./o.T.o.T',
    goldL: 'G....../.......',
    goldR: '......G/.......',
    goldMid: '...G.../.......',
    goldRisk: 'T.G.T../..o.o../.......',
    big: '...B.../.......',
    bigPair: 'B.....B/..o.o../.......',
    bigRun: 'B....../...B.../.....B./...B.../B......',
    zig: '...Z.../.......',
    zigPair: 'Z.....Z/.......',
    zigRun: 'Z...Z../..Z...Z',
    party: 'ooooooo/.......',
    party2: 'o.ooo.o/.......',
    mix: 'B.o.Z.o/.T...T./..o.o..',
    mixG: 'Z.T.G.T/..B.B../.......',
    storm: 'TTT.TTT/Z.o.o.Z/..B.B../.......',
  },
};

const P = (kind, ...ids) => ids.join('/');

// goal = points to reach (hop: top), gold = golden things for the 3rd star.  Hop trips list rows bottom -> top.
export const STAGES = [
  // ---------------------------------------------------------------- World 1 · Meadow Pond
  { kind: 'hop', name: 'First Hops', purpose: 'Teach the bounce: wide lily pads, nothing can go wrong.', lives: 3, pw: 96, seq: ['start', 'zig', 'wide'], gold: 0 },
  { kind: 'catch', name: 'Snack Drop', purpose: 'Slide under falling snacks: catch a few in a row.', lives: 3, gap: 50, speed: 2.4, seq: ['solo', 'left', 'right', 'rest', 'pair', 'solo', 'trio', 'rest', 'stairR', 'rest', 'wavy'], goal: 14, gold: 0 },
  { kind: 'pop', name: 'Pop Pop', purpose: 'Tap bubbles before they float away: the first big pop-streak.', lives: 3, gap: 44, speed: 1.6, seq: ['solo', 'left', 'right', 'pair', 'dots', 'ladder', 'rest', 'cloud', 'dotsb', 'ladderL', 'rest', 'party'], goal: 22, gold: 0 },
  { kind: 'hop', name: 'Wobbly Pads', purpose: 'New: pads that drift side to side. Time your landing.', lives: 3, pw: 88, seq: ['start', 'sway', 'zig', 'sway', 'wide'], gold: 0 },
  { kind: 'catch', name: 'Mind the Spikes', purpose: 'New: grey spikes. Catching one costs a heart; step aside.', lives: 3, gap: 46, speed: 2.5, seq: ['solo', 'pick', 'right', 'spikeRow', 'trio', 'pick', 'left', 'spikeLane', 'pair', 'rest', 'stairL', 'pick', 'wavy'], goal: 18, gold: 0 },
  { kind: 'pop', name: 'Prickly Patch', purpose: 'New: purple thorns. Pop the round ones, leave the prickly.', lives: 3, gap: 42, speed: 1.7, seq: ['dots', 'thornPair', 'ladder', 'thornRow', 'cloud', 'thornPair', 'ladderL', 'thornRow', 'dotsb', 'party2'], goal: 21, gold: 0 },
  { kind: 'hop', name: 'Star Pads', purpose: 'New: golden star pads. Detour for three stars, or just climb.', lives: 3, pw: 84, seq: ['start', 'pearl', 'sway', 'pearls', 'zig', 'pearl'], gold: 4 },
  { kind: 'catch', name: 'Golden Crumb', purpose: 'New: golden snacks, worth 3. One sits beside spikes: risk or reward.', lives: 3, gap: 42, speed: 2.7, seq: ['goldMid', 'solo', 'spikeRow', 'goldL', 'pair', 'goldRisk', 'rest', 'trio', 'spikeLane', 'goldR', 'fork', 'goldRisk', 'stairR', 'goldMid', 'pick'], goal: 28, gold: 4 },
  { kind: 'pop', name: 'Gold Rush', purpose: 'New: fast golden bubbles that rush up the screen. Be quick.', lives: 3, gap: 38, speed: 1.9, seq: ['goldL', 'dots', 'goldR', 'ladder', 'thornPair', 'goldMid', 'cloud', 'goldRisk', 'ladderL', 'goldMid', 'party2', 'goldL'], goal: 34, gold: 5 },
  { kind: 'catch', name: 'Snack Storm', purpose: 'HARD: Meadow boss. Dense rain, spikes and gold. Read the rows ahead.', hard: true, lives: 4, gap: 30, speed: 3.0, seq: ['rain', 'rest', 'dense', 'goldMid', 'storm', 'stairR', 'goldRisk', 'spikeGap', 'stairL', 'goldL', 'rainb', 'dense', 'goldR', 'storm', 'fork', 'goldMid'], goal: 40, gold: 5 },

  // ---------------------------------------------------------------- World 2 · Candy Canyon
  { kind: 'pop', name: 'Sweet Bubbles', purpose: 'Breather: a bubble party after the boss. Pop everything, feel strong.', lives: 3, gap: 30, speed: 1.8, seq: ['party', 'party2', 'dots', 'party', 'cloud', 'dotsb', 'party', 'goldMid', 'party2', 'ladder', 'party'], goal: 47, gold: 1 },
  { kind: 'hop', name: 'Crumble Cakes', purpose: 'New: crumbly pads vanish after one bounce. Never land twice.', lives: 3, pw: 84, seq: ['start', 'crumb', 'zig', 'crumb', 'pearl', 'crumb', 'wide'], gold: 2 },
  { kind: 'catch', name: 'Heavy Hitters', purpose: 'New: heavy snacks fall fast and count double. Get under early.', lives: 3, gap: 40, speed: 2.6, seq: ['heavy', 'solo', 'heavyP', 'pair', 'heavyRun', 'rest', 'spikeLane', 'heavy', 'goldMid', 'trio', 'heavyP', 'stairR', 'goldR', 'heavyRun'], goal: 32, gold: 2 },
  { kind: 'pop', name: 'Big Ones', purpose: 'New: big bubbles need two taps. Start early, finish before they go.', lives: 3, gap: 36, speed: 1.7, seq: ['big', 'dots', 'bigPair', 'thornPair', 'bigRun', 'cloud', 'goldRisk', 'big', 'bigPair', 'ladder', 'goldMid', 'bigRun'], goal: 38, gold: 2 },
  { kind: 'hop', name: 'Spring Time', purpose: 'New: spring pads launch you four rows. Aim your landing.', lives: 3, pw: 80, seq: ['start', 'boing', 'zig', 'boing2', 'sway', 'chain', 'wide'], gold: 1 },
  { kind: 'catch', name: 'Magnet Munch', purpose: 'New: a magnet snack pulls everything near for a few seconds.', lives: 3, gap: 38, speed: 2.7, seq: ['magnet', 'cluster', 'rain', 'rest', 'trio', 'magnet', 'dense', 'cluster', 'stairR', 'goldMid', 'magnet', 'rainb', 'fork', 'goldRisk', 'cluster', 'rain'], goal: 40, gold: 2 },
  { kind: 'pop', name: 'Zig Zag Pops', purpose: 'New: zig-zag bubbles swerve. Tap where they will be.', lives: 3, gap: 34, speed: 1.8, seq: ['zig', 'dots', 'zigPair', 'thornPair', 'zigRun', 'goldMid', 'zig', 'ladder', 'zigPair', 'goldRisk', 'zigRun', 'party2'], goal: 30, gold: 2 },
  { kind: 'hop', name: 'Crumble Climb', purpose: 'Twist: crumbly pads + springs + drifters in one tower.', lives: 3, pw: 78, seq: ['start', 'bumpy', 'crumb', 'boing', 'bumpy', 'pearls', 'crunch', 'boing2'], gold: 3 },
  { kind: 'catch', name: 'Spike Canyon', purpose: 'Twist: heavy snacks and spikes share lanes. Grab the magnet to cheat.', lives: 3, gap: 34, speed: 2.9, seq: ['heavyP', 'spikeGap', 'magnet', 'cluster', 'heavyRun', 'spikeLane', 'goldRisk', 'heavy', 'storm', 'magnet', 'dense', 'goldL', 'heavyRun', 'spikeRow', 'goldR'], goal: 44, gold: 3 },
  { kind: 'pop', name: 'Bubble King', purpose: 'HARD: Canyon boss. Big, zig-zag, thorns and gold at once.', hard: true, lives: 4, gap: 30, speed: 2.0, seq: ['mix', 'goldMid', 'bigRun', 'thornPair', 'zigRun', 'mixG', 'cloud', 'storm', 'goldRisk', 'mix', 'bigPair', 'zigPair', 'mixG', 'goldL', 'storm', 'goldR'], goal: 52, gold: 6 },

  // ---------------------------------------------------------------- World 3 · Cloud Kingdom
  { kind: 'hop', name: 'Stormy Start', purpose: 'New: storm clouds zap you. Weave between them, slowly.', lives: 3, pw: 86, seq: ['start', 'cloudA', 'zig', 'cloudB', 'pearl', 'cloudA', 'wide'], gold: 2 },
  { kind: 'catch', name: 'Cloud Cookies', purpose: 'Breather: magnets everywhere, snacks everywhere. A big happy feast.', lives: 3, gap: 30, speed: 2.5, seq: ['magnet', 'rain', 'cluster', 'rainb', 'magnet', 'dense', 'cluster', 'rain', 'goldMid', 'magnet', 'rainb', 'cluster'], goal: 26, gold: 1 },
  { kind: 'pop', name: 'Thunder Bubbles', purpose: 'Thorn walls with big bubbles behind them. Pick your gap.', lives: 3, gap: 34, speed: 1.9, seq: ['thornGate', 'bigPair', 'thornZig', 'goldRisk', 'thornGate', 'big', 'thornRow', 'bigRun', 'thornGate', 'goldMid', 'thornZig', 'bigPair'], goal: 36, gold: 2 },
  { kind: 'hop', name: 'Windy Ladder', purpose: 'New: wind sways you. Lean into it and land.', lives: 3, pw: 80, wind: 1.1, seq: ['start', 'glide', 'pearl', 'sway', 'bumpy', 'pearls', 'glide', 'cloudB'], gold: 3 },
  { kind: 'catch', name: 'Sky Buffet', purpose: 'Everything: snacks, heavies, gold, spikes, magnets. Plan the route.', lives: 3, gap: 32, speed: 3.0, seq: ['rain', 'heavyRun', 'goldRisk', 'magnet', 'storm', 'cluster', 'spikeGap', 'goldL', 'heavyP', 'dense', 'magnet', 'stairR', 'goldR', 'heavyRun', 'storm', 'goldMid', 'fork'], goal: 56, gold: 4 },
  { kind: 'pop', name: 'Zigzag Storm', purpose: 'Zig-zag bubbles in thorn lanes. Tap fast, tap clean.', lives: 3, gap: 30, speed: 2.1, seq: ['zigPair', 'thornPair', 'zigRun', 'goldRisk', 'thornZig', 'zig', 'mixG', 'zigRun', 'thornGate', 'goldMid', 'zigPair', 'storm'], goal: 36, gold: 3 },
  { kind: 'hop', name: 'Storm Springs', purpose: 'Springs launch you over a storm field. Land between the bolts.', lives: 3, pw: 76, seq: ['start', 'cloudC', 'boing2', 'cloudB', 'chain', 'cloudA', 'squall', 'pearls'], gold: 3 },
  { kind: 'catch', name: 'Rainy Day', purpose: 'Fast heavy snacks and spike lanes. The tempo is the test.', lives: 3, gap: 26, speed: 3.3, seq: ['hrun', 'spikeLane', 'heavyRun', 'dense', 'magnet', 'heavyP', 'storm', 'goldRisk', 'hrun', 'stairL', 'goldMid', 'dense', 'heavyRun', 'goldR', 'storm', 'hrun'], goal: 64, gold: 3 },
  { kind: 'pop', name: 'Pop Parade', purpose: 'A long parade of every bubble. Keep the streak alive for the fever.', lives: 3, gap: 26, speed: 2.2, seq: ['mix', 'party2', 'bigRun', 'zigRun', 'goldMid', 'thornZig', 'party', 'mixG', 'ladder', 'goldRisk', 'bigPair', 'zigPair', 'storm', 'goldL', 'mix', 'party2', 'goldR'], goal: 70, gold: 5 },
  { kind: 'hop', name: "Cloud King's Tower", purpose: 'HARD: final tower. Wind, storms, springs, crumbles. Reach the crown.', hard: true, lives: 4, pw: 72, wind: 1.3, seq: ['start', 'bumpy', 'cloudA', 'pearl', 'tower', 'boing', 'squall', 'crunch', 'pearls', 'cloudC', 'chain', 'tower', 'glide', 'pearls', 'cloudB', 'tower'], gold: 6 },
];

export const rowsOf = (s) => s.seq.map(id => PH[s.kind][id] ?? id).join('/').split('/');

/** Points on offer and golden things for a trip (used by the validator and the star card). */
export function stats(s) {
  const rows = rowsOf(s); let pts = 0, gold = 0;
  const val = s.kind === 'hop' ? {} : s.kind === 'catch' ? { f: 1, h: 2, g: 3 } : { o: 1, B: 2, Z: 1, G: 3 };
  for (const r of rows) for (const c of r) { if (val[c]) pts += val[c]; if ((s.kind === 'hop' && c === 'g') || ((s.kind === 'catch' && c === 'g') || (s.kind === 'pop' && c === 'G'))) gold++; }
  if (s.kind === 'hop') pts = rows.length;
  return { rows: rows.length, pts, gold };
}

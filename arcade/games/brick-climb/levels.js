// Brick Climb v2 — 30 authored climbs in 3 worlds. Each level: what it teaches (why), floors, steps per bridge, who races you and how,
// hazards (gold, bombs, sweeper bars, closed lanes, ice floors), the 3-star goal and a par time (seconds) for 2 stars.
// rs = rival speed factor (the tuner's flow.k() still scales it in game); ai: personality of rival 1,2,3: norm | rush | hoard | hunt.
// kt = how many more bricks the bigger stack needs to knock the smaller one off. pre = rivals' starting bricks.
// goal: {t:'streak'|'smash'|'safe'|'gold', n, txt}
export const WORLDS = [
  { name: 'Sunny Yard', icon: '☀️', bg: ['#c9f0ff', '#e8fff4'], ground: '#ffffff', water: '#7fd6ff', side: '#e9dccb', ui: '#0582ca' },
  { name: 'Candy Quarry', icon: '🍬', bg: ['#ffd1dc', '#ffe9b8'], ground: '#fff0f4', water: '#ffb3c9', side: '#f3cdb8', ui: '#ff5d8f' },
  { name: 'Frost Spire', icon: '❄️', bg: ['#bfdcff', '#f2f8ff'], ground: '#eaf4ff', water: '#8fc8f0', side: '#cfe0f2', ui: '#3a86ff' },
];
const G = (t, n, txt) => ({ t, n, txt });
const defs = [
  // ---- World 1: Sunny Yard — the verb, the bump rule, gold, closed lanes
  [1, 'First Steps', 'Grab blue bricks, lay them as stairs, reach the gold top', { nF: 1, S: 8, rv: 1, rs: 0.3, kt: 4, goal: G('streak', 6, 'pick up 6 bricks in a row') }],
  [2, 'Up We Go', 'Two floors: refill your bricks at each landing', { nF: 2, S: 9, rv: 1, rs: 0.42, kt: 4, goal: G('streak', 8, 'pick up 8 bricks in a row') }],
  [3, 'Bump!', 'A bigger stack knocks a smaller one off: bump a rival', { nF: 2, S: 9, rv: 2, rs: 0.5, kt: 3, ai: ['norm', 'hunt'], goal: G('smash', 1, 'knock a rival\'s stack off') }],
  [4, 'Gold Rush', 'Gold bricks are worth 4: grab them', { nF: 2, S: 10, rv: 2, rs: 0.55, kt: 2, gold: 3, goal: G('gold', 2, 'grab 2 gold bricks') }],
  [5, 'Triple Tower', 'Three floors: keep your pace and your stack', { nF: 3, S: 10, rv: 2, rs: 0.6, kt: 2, gold: 2, ai: ['norm', 'rush'], goal: G('safe', 0, 'never get knocked off') }],
  [6, 'One Way Through', 'A lane is closed: share the others and steal steps', { nF: 2, S: 10, rv: 3, rs: 0.62, kt: 2, block: { 0: 1 }, ai: ['norm', 'rush', 'hunt'], goal: G('smash', 1, 'knock a rival\'s stack off') }],
  [7, 'The Hoarder', 'Green piles up a huge stack: stay clear or outgrow it', { nF: 3, S: 11, rv: 2, rs: 0.7, kt: 2, gold: 2, ai: ['hoard', 'norm'], goal: G('gold', 3, 'grab 3 gold bricks') }],
  [8, 'Head Start', 'Rivals begin with bricks: be quick', { nF: 2, S: 12, rv: 3, rs: 0.62, kt: 2, pre: 3, ai: ['rush', 'norm', 'hunt'], goal: G('streak', 10, 'pick up 10 bricks in a row') }],
  [9, 'Quick Mix', 'Hard: hunters, a closed lane, gold on three floors', { nF: 3, S: 12, rv: 3, rs: 0.8, kt: 2, gold: 2, block: { 1: 0 }, ai: ['norm', 'hunt', 'hoard'], hard: 1, goal: G('safe', 0, 'never get knocked off') }],
  [10, 'Big Red', 'Boss: Red is huge, hunts and hoards', { nF: 3, S: 12, rv: 3, rs: 0.9, kt: 2, pre: 3, gold: 2, ai: ['hunt', 'hoard', 'rush'], boss: 'Big Red', bossCi: 1, goal: G('smash', 2, 'knock 2 stacks off') }],
  // ---- World 2: Candy Quarry — sweeper bars and bombs
  [11, 'Sweeper!', 'The spinning bar knocks your stack off: time your run', { nF: 2, S: 10, rv: 2, rs: 0.6, kt: 2, sweep: [{ f: 0, x: 0, z: 0, r: 3.4, w: 0.028 }], goal: G('safe', 0, 'never get knocked off') }],
  [12, 'Two Bars', 'Gold sits behind two bars turning opposite ways', { nF: 2, S: 11, rv: 2, rs: 0.65, kt: 2, gold: 3, sweep: [{ f: 0, x: -3.2, z: 0, r: 2.6, w: 0.03 }, { f: 0, x: 3.2, z: 0, r: 2.6, w: -0.03 }], goal: G('gold', 3, 'grab 3 gold bricks') }],
  [13, 'Bombs Away', 'Black bombs blow half your stack away: walk round them', { nF: 2, S: 10, rv: 2, rs: 0.65, kt: 2, bomb: 4, goal: G('safe', 0, 'never get hit') }],
  [14, 'Minefield', 'Gold lies between the bombs: choose your steps', { nF: 3, S: 11, rv: 3, rs: 0.7, kt: 2, bomb: 6, gold: 3, ai: ['norm', 'hunt', 'rush'], goal: G('gold', 4, 'grab 4 gold bricks') }],
  [15, 'Bars and Bombs', 'Hard: bar, bombs and a closed lane on three floors', { nF: 3, S: 11, rv: 3, rs: 0.75, kt: 2, bomb: 3, block: { 0: 2 }, sweep: [{ f: 1, x: 0, z: 0, r: 3.6, w: 0.032 }], ai: ['hunt', 'norm', 'hoard'], hard: 1, goal: G('streak', 10, 'pick up 10 bricks in a row') }],
  [16, 'Sugar Rush', 'Breather: sweet and easy, fill up on gold and get FEVER', { nF: 2, S: 9, rv: 2, rs: 0.4, kt: 3, gold: 5, goal: G('streak', 14, 'pick up 14 bricks in a row') }],
  [17, 'Two Hunters', 'Red and Green hunt you: use the bar to your advantage', { nF: 3, S: 12, rv: 3, rs: 0.75, kt: 2, sweep: [{ f: 0, x: 0, z: 0, r: 3.4, w: 0.03 }], ai: ['hunt', 'hunt', 'norm'], goal: G('safe', 0, 'never get knocked off') }],
  [18, 'The Long Climb', 'Four floors: pace yourself and refill', { nF: 4, S: 13, rv: 2, rs: 0.7, kt: 2, gold: 2, bomb: 2, ai: ['norm', 'rush'], goal: G('streak', 12, 'pick up 12 bricks in a row') }],
  [19, 'Gauntlet', 'Hard: two bars, bombs, hunters', { nF: 3, S: 13, rv: 3, rs: 0.78, kt: 2, bomb: 3, sweep: [{ f: 0, x: -3, z: 0, r: 2.8, w: 0.03 }, { f: 1, x: 3, z: 0, r: 2.8, w: -0.03 }], ai: ['hunt', 'norm', 'hunt'], hard: 1, goal: G('smash', 1, 'knock a rival\'s stack off') }],
  [20, 'Green Giant', 'Boss: Green is huge and fast with a bar to dodge', { nF: 4, S: 13, rv: 3, rs: 0.92, kt: 2, pre: 3, bomb: 2, gold: 2, sweep: [{ f: 1, x: 0, z: 0, r: 3.4, w: 0.03 }], ai: ['rush', 'hunt', 'hoard'], boss: 'Green Giant', bossCi: 2, goal: G('smash', 2, 'knock 2 stacks off') }],
  // ---- World 3: Frost Spire — ice
  [21, 'Slippery', 'Ice: you slide, so turn early', { nF: 2, S: 10, rv: 2, rs: 0.55, kt: 2, ice: [0, 1], goal: G('safe', 0, 'never get knocked off') }],
  [22, 'Ice Bars', 'Slide past a bar: a late turn costs your stack', { nF: 2, S: 11, rv: 2, rs: 0.65, kt: 2, ice: [0], sweep: [{ f: 0, x: 0, z: 0, r: 3.4, w: 0.03 }], goal: G('safe', 0, 'never get knocked off') }],
  [23, 'Ice Bombs', 'Bombs on a slippery floor', { nF: 3, S: 11, rv: 2, rs: 0.7, kt: 2, ice: [1], bomb: 4, gold: 2, ai: ['norm', 'rush'], goal: G('gold', 3, 'grab 3 gold bricks') }],
  [24, 'Ice Slalom', 'Two closed lanes on two icy floors', { nF: 3, S: 12, rv: 3, rs: 0.75, kt: 2, ice: [0, 2], block: { 0: 1, 2: 0 }, ai: ['hunt', 'norm', 'rush'], goal: G('smash', 1, 'knock a rival\'s stack off') }],
  [25, 'Whiteout', 'Hard: all floors icy, bars on the first two', { nF: 3, S: 12, rv: 3, rs: 0.8, kt: 2, ice: [0, 1, 2], gold: 2, sweep: [{ f: 0, x: 0, z: 0, r: 3.4, w: 0.03 }, { f: 1, x: 0, z: 0, r: 3.4, w: -0.03 }], ai: ['norm', 'hunt', 'hoard'], hard: 1, goal: G('streak', 10, 'pick up 10 bricks in a row') }],
  [26, 'Snow Day', 'Breather: slow rivals, gold everywhere, get FEVER', { nF: 2, S: 10, rv: 2, rs: 0.45, kt: 3, ice: [0], gold: 5, goal: G('streak', 14, 'pick up 14 bricks in a row') }],
  [27, 'Frost Hunters', 'Hard: three hunters on slippery ground', { nF: 3, S: 13, rv: 3, rs: 0.85, kt: 2, ice: [1], ai: ['hunt', 'hunt', 'hunt'], hard: 1, goal: G('safe', 0, 'never get knocked off') }],
  [28, 'Spire Run', 'Four floors, ice, a bar, bombs and gold', { nF: 4, S: 14, rv: 3, rs: 0.85, kt: 2, ice: [0, 2], bomb: 3, gold: 2, sweep: [{ f: 1, x: 0, z: 0, r: 3.4, w: 0.03 }], ai: ['norm', 'hunt', 'rush'], goal: G('gold', 4, 'grab 4 gold bricks') }],
  [29, 'Everything', 'Hard: every trick in the book', { nF: 4, S: 14, rv: 3, rs: 0.88, kt: 2, ice: [1, 3], bomb: 3, gold: 2, block: { 0: 1, 2: 2 }, sweep: [{ f: 0, x: 0, z: 0, r: 3.4, w: 0.03 }, { f: 2, x: 0, z: 0, r: 3.4, w: -0.03 }], ai: ['hunt', 'hoard', 'hunt'], hard: 1, goal: G('streak', 12, 'pick up 12 bricks in a row') }],
  [30, 'Gold Tyrant', 'Boss: Gold is huge, fast and wants your bricks', { nF: 4, S: 15, rv: 3, rs: 1.03, kt: 2, pre: 4, ice: [2], bomb: 2, gold: 2, sweep: [{ f: 1, x: 0, z: 0, r: 3.4, w: 0.032 }], ai: ['hunt', 'rush', 'hunt'], boss: 'Gold Tyrant', bossCi: 3, goal: G('smash', 2, 'knock 2 stacks off') }],
];
// par: seconds for 2 stars (measured with the QA bot, then given some room)
export const PAR = {1:25,2:35,3:30,4:25,5:30,6:30,7:30,8:30,9:35,10:35,11:50,12:50,13:45,14:30,15:90,16:25,17:70,18:75,19:90,20:80,21:30,22:75,23:30,24:55,25:45,26:25,27:55,28:65,29:90,30:90};
export const LEVELS = defs.map(([n, name, why, o]) => ({ n, name, why, world: Math.floor((n - 1) / 10), ai: ['norm', 'norm', 'norm'], gold: 0, bomb: 0, sweep: [], block: {}, ice: [], pre: 0, par: 60, hard: 0, ...o }));

// Daily Climb: the same seeded climb for everyone each day, built from the same pieces.
export function daily(day) {
  let s = (day * 2654435761) % 2147483647 || 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(R() * a.length)];
  const nF = 2 + Math.floor(R() * 3), ai = [pick(['norm', 'hunt', 'rush', 'hoard']), pick(['hunt', 'hoard', 'norm']), pick(['hunt', 'rush', 'norm'])];
  const sweep = [], block = {}, ice = [];
  for (let f = 0; f < nF; f++) { if (R() < 0.35) sweep.push({ f, x: (R() - 0.5) * 4, z: 0, r: 2.8 + R(), w: (R() < 0.5 ? 1 : -1) * (0.026 + R() * 0.008) }); if (R() < 0.25) block[f] = Math.floor(R() * 3); if (R() < 0.3) ice.push(f); }
  const w = Math.floor(R() * 3);
  return { n: 0, daily: day, name: 'Daily Climb', why: 'Same climb for everyone today', world: w, nF, S: 10 + Math.floor(R() * 5), rv: 3, rs: 0.8 + R() * 0.15, kt: 2, pre: Math.floor(R() * 4), gold: 1 + Math.floor(R() * 3), bomb: Math.floor(R() * 4), sweep, block, ice, ai, par: 70, goal: { t: 'streak', n: 10, txt: 'pick up 10 bricks in a row' }, seed: day };
}

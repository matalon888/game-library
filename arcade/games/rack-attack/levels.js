// levels.js — Rack Attack v2: 36 hand-made tables in 3 worlds. 'trick' = pot everything in the shot limit (par = fewest shots a
// robust solver found: qa/solver.mjs; limit = par + 2); 'duel' = a full 8-ball match against a rival. Coordinates: x ±2.3, z ±4.8
// (the cue starts near z +2.5). Every level has a purpose line. posts [x,z,r,'post'|'bumper'], corks = pocket indexes
// (0 BL, 1 BR, 2 left side, 3 right side, 4 FL, 5 FR... see phys.js), zones [x,z,w,h,'ice'|'mud'].
export const WORLDS = [
  { name: 'CORNER BAR', color: '#13867f', blurb: 'Plain felt. Learn the cue.', rival: ['REX', 'MIA', 'DUKE'] },
  { name: 'HARBOR CLUB', color: '#2a6fb0', blurb: 'Corked pockets and ice.', rival: ['LUNA', 'ACE', 'ZOE'] },
  { name: 'SKYLINE', color: '#7a3fb0', blurb: 'Bumpers, mud, the lot.', rival: ['MAX', 'KIRA', 'THE BOSS'] },
];
export const RIVALS = {
  REX: { e: '🤖', err: 0.13, pw: 0.12, safe: 0.0, talk: ['Bet you miss.', 'Easy money!', 'Is that all?'] },
  MIA: { e: '🦊', err: 0.1, pw: 0.1, safe: 0.1, talk: ['Watch this.', 'Too slow!', 'Oops, I am good.'] },
  DUKE: { e: '🐻', err: 0.08, pw: 0.09, safe: 0.15, talk: ['Rack em up.', 'Nice try.', 'My table.'] },
  LUNA: { e: '🐱', err: 0.065, pw: 0.08, safe: 0.15, talk: ['Purrfect.', 'Sink or swim.', 'Tick tock.'] },
  ACE: { e: '🐯', err: 0.05, pw: 0.07, safe: 0.2, talk: ['Ace in the hole.', 'Read it and weep.', 'Again?'] },
  ZOE: { e: '🐼', err: 0.04, pw: 0.06, safe: 0.25, talk: ['Chill out.', 'Zoe knows.', 'Bamboo bank!'] },
  MAX: { e: '🦁', err: 0.03, pw: 0.05, safe: 0.25, talk: ['Roar!', 'Pressure.', 'Mine.'] },
  KIRA: { e: '🐺', err: 0.022, pw: 0.045, safe: 0.3, talk: ['Hunt.', 'No mercy.', 'Predictable.'] },
  'THE BOSS': { e: '👑', err: 0.015, pw: 0.04, safe: 0.35, talk: ['Kneel.', 'Impressive. Not enough.', 'Last rack.'] },
};
const T = (name, purpose, o) => ({ type: 'trick', name, purpose, ...o });
const D = (name, purpose, g, rival, o = {}) => ({ type: 'duel', name, purpose, g, rival, ...o });
export const LEVELS = [
  // ---------------------------------------------------------------- world 1: Corner Bar
  T('Gimme', 'teach: one ball, one pocket, cannot lose', { balls: [[1, 1.5, -3.6]], cue: [0.55, -2.2] }),
  T('Two Corners', 'two easy pots; the cue ball ends up somewhere new each time', { balls: [[1, -1.5, -3.7], [2, 1.5, -3.7]], cue: [0, -1.2] }),
  T('Side Door', 'the side pockets: aim straight at them', { balls: [[3, 1.4, 0.5], [4, -1.4, -0.6]], cue: [0, 1.6] }),
  D('Rex Opens', 'first duel: a mini rack against a weak rival', 2, 'REX'),
  T('Cluster', 'a tight triangle: hit it right and two drop', { balls: [[1, 0, -2.2], [2, -0.185, -2.52], [3, 0.185, -2.52]], cue: [0.2, 0.5] }),
  T('Pecking Order', 'one ball blocks the other: pot the front one first', { balls: [[5, 0.9, -2.6], [6, 1.5, -3.5]], cue: [0, -0.5] }),
  T('The Post', 'first post: it blocks the straight line', { balls: [[1, 0.9, -3.4], [2, -1.2, -2.2]], cue: [-0.5, 0.6], posts: [[0.5, -2.0, 0.3]] }),
  D('Mia Steps Up', 'duel: Mia leaves nothing to chance', 3, 'MIA'),
  T('Ladder', 'new rule: balls go in 1-2-3 or they come back', { balls: [[1, -1.7, -3.2], [2, 0, -3.8], [3, 1.7, -3.2]], cue: [0, -1.0], order: true }),
  T('Slalom', 'order + two posts to thread', { balls: [[1, -1.4, -2.2], [2, 1.4, -2.0], [3, 0.2, -3.9]], cue: [-0.6, 0.8], order: true, posts: [[-0.3, -1.4, 0.28], [0.9, -3.0, 0.28]] }),
  T('Happy Hour', 'breather: five balls near pockets, easy and flashy', { balls: [[1, -1.9, -4.0], [2, 1.9, -4.0], [3, -1.8, 0.4], [4, 1.8, -0.4], [5, 0, -2.2]], cue: [0, 0.8] }),
  D('Duke, Door Guard', 'boss: Duke with a bigger rack', 4, 'DUKE'),
  // ---------------------------------------------------------------- world 2: Harbor Club
  T('Corked', 'new: two corner pockets are corked, use the others', { balls: [[1, -1.5, 1.2], [2, 1.6, 3.4]], cue: [0, -1.5], corks: [0, 1] }),
  T('Side Hustle', 'only the side pockets are open: straight in', { balls: [[3, -1.5, -0.4], [4, 1.5, 0.4]], cue: [0, 2.0], corks: [0, 1, 4, 5] }),
  T('Ice Rink', 'new: ice, balls glide twice as far', { balls: [[1, -1.0, -2.4], [2, 1.2, -3.6]], cue: [0, 2.4], zones: [[0, -1.5, 5, 2.4, 'ice']] }),
  D('Luna on Ice', 'duel with an ice patch across the middle', 4, 'LUNA', { zones: [[0, 0, 5, 1.6, 'ice']] }),
  T('Cold Bank', 'ice, a post and a ball hiding behind it', { balls: [[5, 1.2, -3.0], [6, -1.5, 1.2]], cue: [0.6, 2.4], zones: [[0, -2.2, 5, 2, 'ice']], posts: [[0.3, -1.9, 0.3]] }),
  T('Cork Ladder', 'order 1-2-3 with the far corners corked', { balls: [[1, -1.6, -0.3], [2, 0, -2.5], [3, 1.6, 0.3]], cue: [0, 2.8], order: true, corks: [4, 5] }),
  T('Eight Last', 'the 8 sits by a pocket: tempting, but it goes last', { balls: [[1, -1.4, -3.4], [2, 1.4, -3.4], [8, 0, -3.9]], cue: [0, -0.5] }),
  D('Ace of Spades', 'duel: Ace with a corked corner', 5, 'ACE', { corks: [0] }),
  T('Splash', 'breather: a cluster and a ball sliding on ice', { balls: [[1, 0, -2.2], [2, -0.185, -2.52], [3, 0.185, -2.52], [4, 1.5, 0.1]], cue: [0.2, 1.8], zones: [[0, 0.3, 5, 1.5, 'ice']] }),
  T('Cork Maze', 'three corks, a post, one way through', { balls: [[1, -1.6, 0.9], [2, -0.9, -3.0]], cue: [0.2, -0.4], corks: [1, 3, 4], posts: [[0.7, -1.8, 0.28]] }),
  T('Cold Snap', 'hard: order on ice with a post', { balls: [[1, -1.4, -3.0], [2, 1.5, -2.2], [3, 0, -4.0]], cue: [0, 2.6], order: true, zones: [[0, -1.2, 5, 2.4, 'ice']], posts: [[0.3, -0.4, 0.28]] }),
  D('Zoe, Harbor Master', 'boss: bigger rack, two corks', 6, 'ZOE', { corks: [0, 1] }),
  // ---------------------------------------------------------------- world 3: Skyline
  T('Pinball', 'new: a bumper kicks balls back out fast', { balls: [[1, 1.5, -3.5], [2, -1.5, -3.5]], cue: [0, -0.8], posts: [[0, -1.8, 0.3, 'bumper']] }),
  T('Double Kicker', 'two bumpers guard the balls', { balls: [[3, -0.8, -3.2], [4, 0.9, -3.8]], cue: [-1.6, 1.2], posts: [[-1.0, -1.3, 0.28, 'bumper'], [1.0, -1.3, 0.28, 'bumper']] }),
  T('Mud Flats', 'new: mud, balls stop dead; hit harder', { balls: [[1, 1.0, -3.2], [2, -1.2, -2.4]], cue: [0, 2.5], zones: [[0, -2.8, 5, 2.2, 'mud']] }),
  D('Max Power', 'duel with bumpers beside the rack', 5, 'MAX', { posts: [[-1.2, -1.0, 0.28, 'bumper'], [1.2, -1.0, 0.28, 'bumper']] }),
  T('Bumper Car', 'bumper + mud + a corked corner', { balls: [[5, 1.0, -3.4], [6, 1.5, -0.9]], cue: [0.3, -1.8], posts: [[-0.9, -2.0, 0.3, 'bumper']], zones: [[0, -3.4, 5, 1.6, 'mud']], corks: [0] }),
  T('Kicker Ladder', 'order 1-2-3 with a bumper in the way', { balls: [[1, -1.5, -2.2], [2, 1.5, -2.6], [3, 0, -4.0]], cue: [-0.6, 0.6], order: true, posts: [[0.1, -0.5, 0.28, 'bumper']] }),
  T('Grand Slam', 'breather: five balls and a big bumper show', { balls: [[1, -1.9, -4.0], [2, 1.9, -4.0], [3, -1.7, 0.1], [4, 1.7, -0.1], [5, 0, -2.6]], cue: [0, 0.9], posts: [[0, -1.2, 0.3, 'bumper']] }),
  D('Kira the Hunter', 'duel: mud in the rack zone', 6, 'KIRA', { zones: [[0, -3.0, 5, 2.4, 'mud']] }),
  T('Everything', 'cork, bumper, ice and mud on one table', { balls: [[1, -1.5, -3.2], [2, 1.5, -0.6], [3, -1.3, 1.0]], cue: [0.6, 3.4], corks: [1], posts: [[0, -1.5, 0.3, 'bumper']], zones: [[0, -3.3, 5, 1.8, 'mud'], [0, 0.8, 5, 1.4, 'ice']] }),
  T('Gauntlet', 'hard: order, bumpers and corks', { balls: [[1, 1.5, -3.6], [2, -1.5, 0.5], [3, 1.5, 1.0], [4, -1.6, 3.6]], cue: [0.5, -2.0], order: true, corks: [0, 5], posts: [[-0.7, -2.2, 0.28, 'bumper'], [0.2, 0.5, 0.28, 'bumper']] }),
  T('Eight Ball Finale', 'last trick table: 1, 2, 3 and then the 8', { balls: [[1, -1.4, -3.4], [2, 1.4, -3.4], [3, -1.6, 0.3], [8, 1.6, -0.4]], cue: [0, -1.4], order: true, posts: [[-0.5, -0.4, 0.25, 'bumper'], [0.5, -0.4, 0.25, 'bumper']] }),
  D('THE BOSS', 'final duel: the full rack against the best rival', 7, 'THE BOSS', { posts: [[-1.3, -0.2, 0.28, 'bumper'], [1.3, -0.2, 0.28, 'bumper']] }),
];

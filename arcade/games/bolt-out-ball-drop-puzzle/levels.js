// Bolt Out v2 — 36 hand-picked vessels in 3 worlds. Layout format and rules: logic.js.
//   lanes: up to two lanes of bolts, top to bottom · tail: wide bolts below where the lanes meet · C colour G grey B bomb O goo - empty
//   twins: [a, b] bolts pulled by one tap · locks: [bolt, key] bolt can't move until key is out · ids: a0 b1 (lane, row) t0 (tail row)
// Found with qa/search.mjs, then chosen, ordered and named by hand; qa/levels.mjs checks each one (solvable, par, traps, that the
// new element really changes the answer). Hard ones get a red frame.
export const WORLDS = [
  { name: 'The Garage', blurb: 'Colour, grey and bombs', color: '#ff5d8f', bg: ['#ffd1dc', '#ffe9b8'], ui: '#ff5d8f', a: '#ff5d8f', m: ['#ff9fb8', '#ffd48a'] },
  { name: 'The Lab', blurb: 'Goo and twin bolts', color: '#2a9d8f', bg: ['#b8f2e6', '#e3f6ff'], ui: '#2a9d8f', a: '#3ab795', m: ['#5fd1be', '#a9dcf5'] },
  { name: 'The Foundry', blurb: 'Locked bolts', color: '#ff8c42', bg: ['#ffd9b8', '#e8d4ff'], ui: '#ff7a2e', a: '#ff8c42', m: ['#ffa56a', '#c8a8ef'] },
];
export const PER = 12;
export const LEVELS = [
  // ---- The Garage
  { lanes: [['C']], why: 'pull the only bolt' },
  { lanes: [['C', 'C']], why: 'two bolts, any order' },
  { lanes: [['C', 'G']], why: 'grey needs colour first: top bolt first' },
  { lanes: [['B', 'C']], why: 'a bomb you can simply leave' },
  { lanes: [['B', 'C', 'G']], why: 'colour lands on grey and turns it' },
  { lanes: [['G', 'B', 'C']], why: 'grey lands on a bomb: pop' },
  { lanes: [['C', 'B', 'G']], why: 'pop the bomb first, then colour converts' },
  { lanes: [['C'], ['C']], tail: ['-'], why: 'two lanes meet in the wide bolt' },
  { lanes: [['G'], ['C']], tail: ['-'], why: 'the grey lane meets the colour lane' },
  { lanes: [['C', 'B'], ['G']], tail: ['-'], why: 'a bomb behind a colour' },
  { lanes: [['B', 'C', 'G'], ['C']], tail: ['B'], hard: 1, why: 'HARD: bombs top and bottom, one way through' },
  { lanes: [['C', 'C'], ['C', 'C']], tail: ['C'], why: 'breather: pull them all, enjoy the pour' },
  // ---- The Lab
  { lanes: [['O'], ['C']], tail: ['-'], why: 'goo spoils the jar: leave it where it is' },
  { lanes: [['C'], ['C']], tail: ['O', 'B'], why: 'goo meets a bomb: both vanish' },
  { lanes: [['G'], ['C', 'O']], tail: ['B'], why: 'goo under your colour, a bomb to clear it' },
  { lanes: [['C'], ['-', 'C', 'O']], tail: ['B'], why: 'the same trick with a spare bolt' },
  { lanes: [['C'], ['C']], tail: ['-'], twins: [['a0', 'b0']], why: 'twin bolts: one tap pulls both' },
  { lanes: [['C'], ['G', '-']], tail: ['B', 'G'], twins: [['a0', 'b1']], why: 'twins feed the same wide bolt together' },
  { lanes: [['G', 'B'], ['C']], tail: ['B', 'G'], twins: [['a1', 'b0']], why: 'twins on the lower bolts' },
  { lanes: [['C', 'O'], ['B', 'B', 'C']], tail: ['G', 'B'], twins: [['a0', 'b0']], hard: 1, why: 'HARD: twins, goo and three bombs' },
  { lanes: [['C', 'G'], ['G', 'C']], tail: ['G', 'G'], twins: [['a0', 'b0']], why: 'breather: greys everywhere, colour fixes them' },
  { lanes: [['O', 'C'], ['-', 'C']], tail: ['G', 'B'], twins: [['a1', 'b0']], why: 'goo above, a twin pull with it' },
  { lanes: [['C'], ['G', 'O', 'G']], tail: ['B'], twins: [['a0', 'b0']], why: 'goo between greys' },
  { lanes: [['O', 'C', 'B'], ['C', '-', 'O']], tail: ['G'], twins: [['a2', 'b1']], hard: 1, why: 'HARD: goo both sides, twins across lanes' },
  // ---- The Foundry
  { lanes: [['C'], ['C']], tail: ['-'], locks: [['t0', 'a0']], why: 'a padlocked bolt waits for its key bolt' },
  { lanes: [['G', 'G', 'B'], ['B']], tail: ['C'], locks: [['a1', 'a0']], why: 'the key is above the lock' },
  { lanes: [['C'], ['G', 'C', 'B']], tail: ['G'], locks: [['b0', 't0']], why: 'the key is below: pull it first' },
  { lanes: [['C', 'B'], ['G']], tail: ['-', 'G'], locks: [['b0', 't0']], why: 'a lock across the vessel' },
  { lanes: [['G', '-'], ['G', 'B', 'C']], tail: ['B'], twins: [['a1', 'b1']], locks: [['a0', 'b0']], why: 'twins and a lock together' },
  { lanes: [['-', 'O', 'C'], ['O', 'B']], tail: ['B', 'C'], twins: [['a0', 'b0']], locks: [['b1', 't1']], hard: 1, why: 'HARD: goo, bombs, twins, one lock' },
  { lanes: [['C', 'C', 'C'], ['C', 'C']], tail: ['-'], locks: [['t0', 'b1']], why: 'breather: a big pour, one lock' },
  { lanes: [['-', 'G', 'C'], ['C', 'B']], tail: ['G'], twins: [['a0', 'b0']], locks: [['a1', 'a0']], why: 'a twin that is also a key' },
  { lanes: [['C', 'B'], ['G', 'B', 'O']], tail: ['G'], twins: [['a0', 'b1']], locks: [['b2', 'a0']], why: 'lock on the goo bolt' },
  { lanes: [['G'], ['C', 'O', 'B']], tail: ['-', 'B'], twins: [['a0', 'b0']], locks: [['t0', 'a0']], why: 'a locked wide bolt over goo' },
  { lanes: [['-', 'C', '-'], ['B', 'G', 'O']], tail: ['G'], twins: [['a2', 'b2']], locks: [['b1', 'a1']], why: 'every rule at once' },
  { lanes: [['B', 'G', 'G'], ['C', 'O', 'B']], tail: ['G'], twins: [['a2', 'b2']], locks: [['b1', 'a0']], hard: 1, why: 'HARD boss: the whole workshop' },
];

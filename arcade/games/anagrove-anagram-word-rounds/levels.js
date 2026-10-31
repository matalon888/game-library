// levels.js — Anagrove v2: 30 hand-picked rounds in 3 groves. Each level is a six-letter word (b) whose wall comes from our
// everyday word list, a goal for the second star (g), a clock in seconds (t), the share of the wall for the third star (s3),
// and a twist (tw). qa/check.mjs checks every level in node: the goal is reachable, the twist never blocks the round,
// the clock is long enough for 3 stars at a human pace.
//   g: ['words', n] | ['long', n] | ['start', letter, n] | ['score', n] | ['chain', n] | ['gold'] | ['fast', seconds]
//   tw: { wilt: n  (one tile is wilted until n words are found), thorn: s (a wrong word costs s seconds),
//         wind: s (the tiles are blown around every s seconds), fog: 1 (the wall is hidden: words appear as you find them) }
//   hint: 2 = every slot shows its first letter, 1 = only the 5-6 letter slots
export const WORLDS = [
  { name: 'Sprout Meadow', sub: 'find the long word', c1: '#3f9a6a', c2: '#a8e063' },
  { name: 'Whisper Woods', sub: 'wilted tiles, thorns, wind', c1: '#2f6f7a', c2: '#7fd1c0' },
  { name: 'Ember Canopy', sub: 'fog over the wall', c1: '#a8552e', c2: '#f3b562' },
];
export const LEVELS = [
  // ---- world 1: Sprout Meadow — the core verb, one new idea at a time
  { b: 'secret', t: 240, g: ['words', 5], hint: 2, s3: 0.8, p: 'Level 1 cannot be lost: first letters of every slot are shown, a generous clock; the wall fills and the six-letter word unlocks NEXT' },
  { b: 'street', t: 180, g: ['words', 6], hint: 1, gold: 1, s3: 0.8, p: 'Goal for the second star appears; first letters only on the long slots; quick words start a chain' },
  { b: 'simple', t: 120, g: ['chain', 3], gold: 1, s3: 0.85, p: 'First real clock and the first level that can be lost; chain three quick words' },
  { b: 'escape', t: 130, g: ['long', 3], tw: { wilt: 2 }, s3: 0.8, p: 'First twist, early: one tile droops until two words wake it; longer words matter more, find three of 5 letters or more' },
  { b: 'friend', t: 150, g: ['gold'], gold: 1, s3: 0.75, p: 'Introduce the golden word: one gold slot is worth +10 s and seeds' },
  { b: 'island', t: 160, g: ['start', 's', 3], s3: 0.75, p: 'A letter goal: words that start with one letter, a way of looking at the tiles' },
  { b: 'silver', t: 90, g: ['fast', 40], s3: 0.8, p: 'Speed: find the six-letter word within 40 s (a short wall, a short clock)' },
  { b: 'winter', t: 150, g: ['words', 12], gold: 1, s3: 0.75, p: 'Twist: a long wall and a gold slot together, find twelve words' },
  { b: 'signal', t: 140, g: ['chain', 4], gold: 1, s3: 0.7, p: 'Chain four with a gold slot waiting: bloom time (double points) is within reach' },
  { b: 'enters', t: 170, g: ['words', 15], gold: 1, s3: 0.7, hard: 1, p: 'HARD · Great Oak: the biggest wall of the meadow, fifteen words and a gold slot' },
  // ---- world 2: Whisper Woods — wilted tiles, thorns, wind
  { b: 'spirit', t: 120, g: ['words', 8], s3: 0.8, p: 'Breather after the boss: a friendly wall, quick stars, the woods open' },
  { b: 'course', t: 130, g: ['words', 8], tw: { wilt: 2 }, s3: 0.7, p: 'Introduce the wilted tile: one tile is drooping, find two words to wake it' },
  { b: 'knight', t: 100, g: ['long', 2], tw: { wilt: 2 }, s3: 0.8, p: 'Practise: wilted tile on a short wall; the wake-up words must come from the other tiles' },
  { b: 'dragon', t: 140, g: ['gold'], gold: 1, tw: { wilt: 3 }, s3: 0.7, p: 'Twist: a wilted tile and a golden slot, three words to wake it' },
  { b: 'desert', t: 150, g: ['words', 9], tw: { thorn: 3 }, s3: 0.75, p: 'Introduce thorns: a wrong word costs three seconds, so think before ENTER' },
  { b: 'rescue', t: 110, g: ['long', 3], gold: 1, tw: { thorn: 3 }, s3: 0.8, p: 'Practise: thorns plus a gold slot, risk a guess for the gold or play safe' },
  { b: 'flames', t: 140, g: ['words', 10], tw: { wind: 30 }, s3: 0.7, p: 'Introduce wind: every 30 seconds the tiles are blown around, a leaf warns you first' },
  { b: 'planes', t: 170, g: ['chain', 4], tw: { wilt: 2, thorn: 3 }, s3: 0.7, p: 'Twist: a wilted tile and thorns on a wall with many words' },
  { b: 'recipe', t: 110, g: ['words', 8], gold: 1, tw: { wind: 30 }, s3: 0.8, p: 'Practise: wind and a gold slot on a short wall' },
  { b: 'things', t: 180, g: ['words', 14], gold: 1, tw: { wilt: 2, wind: 30 }, s3: 0.7, hard: 1, p: 'HARD · Old Willow: a wilted tile, wind and a gold slot' },
  // ---- world 3: Ember Canopy — fog, and all the old tricks together
  { b: 'shapes', t: 140, g: ['words', 8], tw: { fog: 1 }, s3: 0.75, p: 'Introduce fog: the wall is hidden, words appear as you find them; a short list keeps it kind' },
  { b: 'dreams', t: 170, g: ['long', 3], tw: { fog: 1 }, s3: 0.7, p: 'Practise: fog and long words; the count tells you how many are left' },
  { b: 'sports', t: 170, g: ['start', 's', 5], tw: { fog: 1 }, s3: 0.7, p: 'Fog with a letter goal: words starting with S, think of a prefix' },
  { b: 'states', t: 160, g: ['words', 10], tw: { fog: 1, thorn: 3 }, s3: 0.7, p: 'Twist: fog and thorns, every guess counts' },
  { b: 'clears', t: 150, g: ['words', 12], gold: 1, s3: 0.7, p: 'Breather: a clear wall and a gold slot after the fog, a long list to run through' },
  { b: 'blades', t: 170, g: ['words', 12], tw: { wilt: 2, wind: 30 }, s3: 0.7, p: 'Back to the old tricks: a wilted tile and wind on a long wall' },
  { b: 'shouts', t: 130, g: ['chain', 5], gold: 1, tw: { thorn: 3, wind: 30 }, s3: 0.7, p: 'Chain five through the wind and the thorns, with a gold slot to chase' },
  { b: 'tailor', t: 160, g: ['words', 10], tw: { wilt: 2, thorn: 3, wind: 30 }, s3: 0.7, p: 'Three tricks at once: wilted tile, thorns and wind' },
  { b: 'brakes', t: 190, g: ['words', 12], tw: { fog: 1, wilt: 2 }, s3: 0.65, p: 'Fog and a wilted tile: you cannot see the wall and one tile is asleep' },
  { b: 'resist', t: 200, g: ['words', 16], tw: { fog: 1, thorn: 3, wind: 30 }, s3: 0.65, hard: 1, p: 'HARD · Elder Grove: fog, thorns and wind, the biggest wall of all' },
];

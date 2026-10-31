// Chimebox deep v2: 30 authored songs-in-a-box. Each row: one idea, one purpose line.
// song = key in _music/songs.js; from..to = which notes of the tune are played (a verse, a chorus or the whole thing);
// sh = box shape (0 circle, 6 hexagon, 4 square, 5 pentagon, 3 triangle, 8 octagon); spawn = fractions of the song at which a new ball joins;
// g = how fast balls grow (1 = the v1 pace); gold = golden walls; pegs = free-note pegs [x, y] in box radii; sour = sour walls (they only hurt);
// spin = the box turns by itself (rad/s); grav = gravity (9.5 normal, 5.6 moon); stars = shrink-stars floating inside;
// s2 / s3 = biggest ball (share of the box) allowed for 2 / 3 stars.
export const WORLDS = [
  { name: 'MUSIC BOX', sub: 'Turn the box, catch the gold', c1: '#ffd6e8', c2: '#fff2c7', ui: '#ff7eb6' },
  { name: 'GLASS HALL', sub: 'Pegs, sour walls, a spinning room', c1: '#cde7ff', c2: '#f3e5ff', ui: '#6c8cff' },
  { name: 'STARLIGHT', sub: 'Moon gravity and falling stars', c1: '#2b2457', c2: '#5a3f8f', ui: '#b07bff' },
];

export const LEVELS = [
  // ---- world 1: MUSIC BOX (the core verb, then more balls)
  { song: 'twinkle', from: 0, to: 12, sh: 0, gold: 2, g: 0.50, why: 'Tap, hear it. Cannot lose.', s2: 1.00, s3: 1.00 },
  { song: 'twinkle', from: 0, to: 24, sh: 6, gold: 2, g: 0.90, why: 'Gold walls shrink the ball and play a chord.', s2: 1.00, s3: 1.00 },
  { song: 'twinkle', from: 0, to: 42, sh: 4, gold: 2, g: 2.60, why: 'The whole tune. The first one that can fill up.', s2: 0.50, s3: 0.28 },
  { song: 'ode', from: 0, to: 24, sh: 0, gold: 2, g: 1.46, why: 'A new tune, a round box.', s2: 0.50, s3: 0.28 },
  { song: 'ode', from: 0, to: 40, sh: 6, gold: 2, g: 3.81, spawn: [0.5], why: 'A second ball joins halfway.', s2: 0.52, s3: 0.47 },
  { song: 'saints', from: 0, to: 33, sh: 5, gold: 2, g: 3.47, spawn: [0.5], why: 'Five walls, quick notes.', s2: 0.55, s3: 0.28 },
  { song: 'minuet', from: 0, to: 32, sh: 4, gold: 2, g: 3.68, spawn: [0.4], why: 'Waltz time: the ball lands on the beat.', s2: 0.85, s3: 0.30 },
  { song: 'ode', from: 0, to: 62, sh: 6, gold: 2, g: 3.64, spawn: [0.35, 0.7], why: 'Three balls, one golden wall each.', s2: 0.61, s3: 0.31 },
  { song: 'minuet', from: 0, to: 48, sh: 0, gold: 2, g: 0.95, spawn: [0.4, 0.7], why: 'Three balls in the round box.', s2: 0.50, s3: 0.28 },
  { song: 'elise', from: 0, to: 50, sh: 6, gold: 2, g: 3.81, spawn: [0.3, 0.6], boss: 1, why: 'BOSS: Für Elise, three balls.', s2: 0.50, s3: 0.54 },
  // ---- world 2: GLASS HALL (pegs, sour walls, a box that turns by itself)
  { song: 'canon', from: 0, to: 26, sh: 0, gold: 2, g: 1.50, pegs: [[0, 0]], why: 'A peg plays a free note: bounce off it.', s2: 0.50, s3: 0.28 },
  { song: 'canon', from: 0, to: 40, sh: 4, gold: 2, g: 4.00, pegs: [[-0.45, 0.1], [0.45, 0.1]], why: 'Two pegs split the box.', s2: 0.50, s3: 0.34 },
  { song: 'cancan', from: 0, to: 30, sh: 6, gold: 2, g: 2.98, pegs: [[0, 0.25]], spawn: [0.5], why: 'Pegs, plus a second ball.', s2: 0.53, s3: 0.28 },
  { song: 'saints', from: 0, to: 33, sh: 3, gold: 2, g: 1.08, sour: 1, why: 'A sour wall: it makes the ball grow. Avoid it.', s2: 0.83, s3: 0.38 },
  { song: 'cancan', from: 0, to: 49, sh: 4, gold: 2, g: 1.43, sour: 1, pegs: [[0, 0]], spawn: [0.5], why: 'Sour wall and peg together.', s2: 0.50, s3: 0.37 },
  { song: 'ode', from: 0, to: 62, sh: 5, gold: 2, g: 0.95, sour: 2, spawn: [0.4], why: 'Two sour walls on five sides.', s2: 0.50, s3: 0.28 },
  { song: 'minuet', from: 0, to: 40, sh: 0, gold: 2, g: 1.39, spin: 0.35, why: 'The box turns on its own now.', s2: 0.50, s3: 0.28 },
  { song: 'canon', from: 0, to: 53, sh: 6, gold: 2, g: 2.47, spin: 0.4, pegs: [[0, 0]], spawn: [0.5], why: 'Spinning box with a peg.', s2: 0.50, s3: 0.28 },
  { song: 'cancan', from: 0, to: 49, sh: 4, gold: 2, g: 1.81, spin: 0.45, sour: 1, spawn: [0.4, 0.7], why: 'Spin, a sour wall, three balls.', s2: 0.65, s3: 0.60 },
  { song: 'mountain', from: 0, to: 70, sh: 8, gold: 2, g: 0.91, spin: 0.3, sour: 2, pegs: [[-0.4, 0.2], [0.4, 0.2]], spawn: [0.3, 0.6], boss: 1, why: 'BOSS: the Mountain King, eight walls.', s2: 0.50, s3: 0.42 },
  // ---- world 3: STARLIGHT (moon gravity, shrink stars, everything together)
  { song: 'neon', from: 0, to: 30, sh: 0, gold: 2, g: 1.29, grav: 5.6, why: 'Moon gravity: the ball floats.', s2: 0.50, s3: 0.41 },
  { song: 'starlight', from: 0, to: 40, sh: 6, gold: 2, g: 4.00, grav: 5.6, stars: 1, why: 'Touch a star with the ball: it shrinks.', s2: 0.68, s3: 0.60 },
  { song: 'turkish', from: 0, to: 40, sh: 4, gold: 2, g: 4.00, stars: 1, spawn: [0.5], why: 'Stars in the normal gravity.', s2: 0.50, s3: 0.34 },
  { song: 'elise', from: 0, to: 50, sh: 0, gold: 2, g: 4.00, grav: 5.6, stars: 2, spin: 0.3, why: 'Floating balls, two stars, a slow spin.', s2: 0.68, s3: 0.34 },
  { song: 'neon', from: 0, to: 60, sh: 5, gold: 2, g: 2.64, sour: 1, pegs: [[0, 0]], stars: 1, spawn: [0.4], why: 'Everything from the Glass Hall, plus a star.', s2: 0.58, s3: 0.30 },
  { song: 'turkish', from: 0, to: 72, sh: 4, gold: 2, g: 2.50, spin: 0.4, sour: 1, stars: 1, spawn: [0.35, 0.7], why: 'The Turkish rondo in a spinning box.', s2: 0.85, s3: 0.60 },
  { song: 'mountain', from: 0, to: 60, sh: 6, gold: 2, g: 3.05, grav: 5.6, pegs: [[-0.4, 0], [0.4, 0]], stars: 1, spawn: [0.3, 0.6], why: 'Moon gravity, two pegs, three balls.', s2: 0.50, s3: 0.28 },
  { song: 'starlight', from: 0, to: 81, sh: 3, gold: 2, g: 1.39, stars: 2, sour: 1, spawn: [0.3, 0.6], why: 'The longest one, in a triangle.', s2: 0.50, s3: 0.33 },
  { song: 'canon', from: 0, to: 53, sh: 8, gold: 2, g: 1.22, spin: 0.35, sour: 2, pegs: [[0, 0]], stars: 1, spawn: [0.3, 0.6], why: 'Eight walls, two sour, spinning.', s2: 0.50, s3: 0.42 },
  { song: 'turkish', from: 0, to: 72, sh: 8, gold: 2, g: 1.43, grav: 6.4, spin: 0.3, sour: 2, pegs: [[-0.4, 0.2], [0.4, 0.2]], stars: 2, spawn: [0.25, 0.5, 0.75], boss: 1, why: 'FINALE: four balls, the whole rondo.', s2: 0.50, s3: 0.36 },
];

// ball skins: one more every 10 stars (the first is free)
export const CHARMS = [
  { name: 'Candy', cols: ['#3ab7ff', '#ff6fa3', '#59d98e', '#b07bff', '#ff8c42'] },
  { name: 'Pearl', cols: ['#f4f1ee', '#ffd9e6', '#dfeaff', '#e9ffe9', '#fff1cf'] },
  { name: 'Mint', cols: ['#36c99a', '#7be8c4', '#1fa27a', '#9af2d6', '#52d6a8'] },
  { name: 'Sunset', cols: ['#ff7a45', '#ffb347', '#ff5d6c', '#ffd23f', '#ff8fa3'] },
  { name: 'Ice', cols: ['#7fd4ff', '#b8ebff', '#5fb8ff', '#d6f4ff', '#8fe1f5'] },
  { name: 'Grape', cols: ['#9a6bff', '#c39bff', '#7a4de0', '#e0c8ff', '#b07bff'] },
  { name: 'Cherry', cols: ['#ff3b5c', '#ff7a90', '#d81e42', '#ffadb9', '#ff5d6c'] },
  { name: 'Gold Leaf', cols: ['#ffd23f', '#ffe27a', '#ffb300', '#fff0a6', '#f5c518'] },
  { name: 'Galaxy', cols: ['#4b2fa8', '#7b5cff', '#2a1b6b', '#c05bff', '#3a86ff'] },
];

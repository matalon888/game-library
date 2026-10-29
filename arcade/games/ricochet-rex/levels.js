// Ricochet Rex v2: 36 hand-made rooms in 3 worlds (studio, 2026-10-29). Original rooms, designed for this game.
// Room coordinates: x −4.6 (left wall) … 4.6 (right wall), y 0 = floor … 15.6 = ceiling. Units are game metres:
// a goon is 1.0 wide and 2.05 tall, the agent's gun is 1.34 above his feet.
//   a: agent feet [x, y]       g: goons [[x, y]]           G: armoured goons (two hits; a bounce back through counts)
//   h: hostages (never hit)    s: solid blocks [[x0, y0, x1, y1]] (walls bounce bullets)
//   c: crates (x, bottom y)    w: weights on a rope from the ceiling (x, bottom y)    t: TNT (x, bottom y)
//   gl: glass panes [[x0, y0, x1, y1]] (stop a bullet and shatter; TNT breaks them too)
//   m: steel mirrors [[x1, y1, x2, y2]] (angled bounce)
//   par: fewest bullets that clear it (from the solver, qa/rooms.cjs) = 3 stars; par + 1 = 2 stars; more = 1 star
// Teaching cycle per element: introduce (can't fail) → practise → twist → test (HARD) → breather.
const R = 4.6, T = 15.6;
const ledge = (x0, x1, y, t = 0.6) => [x0, y - t, x1, y];
const pillar = (x, w, h, y = 0) => [x - w / 2, y, x + w / 2, y + h];

export const WORLDS = [
  { name: 'Timber Woods', theme: 'forest', idea: 'bank shots, crates and ropes' },
  { name: 'Dust Gulch', theme: 'desert', idea: 'TNT, hostages and glass' },
  { name: 'Neon City', theme: 'city', idea: 'armoured goons and steel mirrors' },
];

// suits: unlocked by total stars, worn by the agent (cosmetic only)
export const SUITS = [
  { name: 'Navy', stars: 0, body: '#2f55b5', legs: '#22397a' },
  { name: 'Crimson', stars: 6, body: '#c4352f', legs: '#7a1f1c' },
  { name: 'Forest', stars: 15, body: '#2f8f4e', legs: '#1d5a31' },
  { name: 'Royal', stars: 27, body: '#6a3fc1', legs: '#3f2577' },
  { name: 'Desert', stars: 40, body: '#d9a441', legs: '#8a6420' },
  { name: 'Ice', stars: 54, body: '#e9f2fb', legs: '#9fb3c8' },
  { name: 'Midnight', stars: 70, body: '#23252e', legs: '#14151b' },
  { name: 'Gold', stars: 90, body: '#f4c430', legs: '#b8860b' },
];

export const LEVELS = [
  // ---------------------------------------------------------------- world 1: Timber Woods (goons, walls, crates, ropes)
  // 1 introduce: one goon, clear line, the sight is already on him (can't fail)
  { n: 'First Contact', par: 1, a: [-3.5, 0], g: [[2.2, 0]] },
  // 2 tiny decision: two goons in one line, one bullet gets both
  { n: 'Lined Up', par: 1, a: [-3.5, 0], g: [[0.4, 0], [3.0, 0]] },
  // 3 first room you can lose: the pillar hides him, bank off the ceiling or the wall
  { n: 'Over the Top', par: 1, a: [-3.5, 0], g: [[2.9, 0]], s: [pillar(0.3, 0.8, 6)] },
  // 4 practise: three heights, pick the order
  { n: 'Upstairs', par: 2, a: [-3.5, 0], g: [[3.0, 5.5], [-3.0, 10], [3.2, 0]], s: [ledge(1.4, R, 5.5), ledge(-R, -1.2, 10)] },
  // 5 introduce crates: shove the crate off the ledge onto the goon behind the stump
  { n: 'Heavy Box', par: 2, a: [-3.5, 0], g: [[1.2, 0], [-2.6, 7], [3.4, 0]], s: [ledge(-R, 0.4, 7), pillar(-1.1, 0.6, 3.4)], c: [[-0.05, 7]] },
  // 6 introduce ropes: the goon in the pit is out of reach, the weight above him isn't
  { n: 'Cut the Rope', par: 1, a: [-3.5, 0], g: [[2.9, 0], [-0.4, 0]], s: [pillar(1.2, 0.5, 3.6)], w: [[2.9, 6.5]] },
  // 7 practise banks: both goons sit behind cover
  { n: 'Corner Pocket', par: 2, a: [-3.5, 0], g: [[3.3, 0], [3.3, 9]], s: [pillar(1.6, 0.6, 4.6), ledge(1.2, R, 9), [1.2, 9, 1.6, 10.6]] },
  // 8 twist: one flat shot can cut both ropes
  { n: 'Two Ropes', par: 1, a: [-3.5, 0], g: [[0.95, 0], [3.35, 0], [-3.5, 10]], s: [pillar(-0.2, 0.5, 3.2), pillar(2.1, 0.5, 3.2), ledge(-R, -2.2, 10)], w: [[0.95, 5.8], [3.35, 5.8]] },
  // 9 HARD test: crates, a rope and banks with six goons
  { n: 'Lumber Yard', par: 2, hard: true, a: [-3.6, 0],g: [[-3.2, 6], [2.4, 4.5], [3.6, 4.5], [3.3, 9.5]],
    s: [ledge(-R, -1.6, 6), ledge(0.6, R, 4.5), ledge(1.6, R, 9.5), pillar(-0.4, 0.5, 2.4), [0.6, 4.5, 1.0, 5.9]], w: [[3.3, 12]], c: [[-2.0, 6]] },
  // 10 breather: four goons on one long ledge, one flat shot
  { n: 'Timber!', par: 1, a: [-3.7, 6], g: [[-0.6, 6], [0.9, 6], [2.4, 6], [3.9, 6]], s: [ledge(-R, -2.6, 6), ledge(-1.3, R, 6)] },
  // 11 practise: a shaft with covered ledges on both walls, every goon needs a bank
  { n: 'Zigzag', par: 2, a: [0, 0], g: [[-3.4, 5.5], [3.4, 9], [-3.4, 12.5]],
    s: [ledge(-R, -1.8, 5.5), ledge(1.8, R, 9), ledge(-R, -1.8, 12.5), [-2.2, 5.5, -1.8, 6.9], [1.8, 9, 2.2, 10.4]] },
  // 12 HARD world test: banks, a crate and a rope together
  { n: 'Sawmill', par: 3, hard: true, a: [-3.6, 0], g: [[1.3, 0], [3.6, 0], [1.6, 7.5], [3.7, 7.5], [-3.2, 10]],
    s: [pillar(-1.4, 0.5, 4), ledge(-0.4, R, 7.5), [-0.4, 7.5, 0, 8.9], ledge(-R, -1.6, 10), pillar(2.5, 0.5, 3)], w: [[-3.2, 12.6]], c: [[2.6, 7.5]] },

  // ---------------------------------------------------------------- world 2: Dust Gulch (TNT, hostages, glass)
  // 13 introduce TNT: one bullet into the keg clears the ledge
  { n: 'Powder Keg', par: 1, a: [-3.5, 0], g: [[1.5, 7], [3.8, 7]], s: [ledge(0.8, R, 7)], t: [[2.65, 7]] },
  // 14 twist: the first keg sets off the hidden one behind the slab
  { n: 'Chain Reaction', par: 1, a: [-3.5, 0], g: [[-0.7, 8], [3.0, 8], [4.05, 8]], s: [ledge(-1.5, R, 8), [1.3, 8, 1.7, 9.6]], t: [[0.6, 8], [2.3, 8]] },
  // 15 practise: bank into a keg behind the wall
  { n: 'Bank Fuse', par: 2, a: [-3.5, 0], g: [[1.8, 0], [3.9, 0], [3.0, 10]], s: [pillar(0.5, 0.6, 7), ledge(1.5, R, 10)], t: [[2.85, 0]] },
  // 16 HARD test: kegs, a rope and three heights
  { n: 'Dynamite Ridge', par: 2, hard: true, a: [-3.6, 9], g: [[-1.2, 0], [1.5, 0], [3.5, 0], [1.4, 4], [3.6, 4], [3.2, 11.5]],
    s: [ledge(-R, -2.2, 9), ledge(-0.6, R, 4), ledge(1.6, R, 11.5), pillar(0.2, 0.5, 2.2, 4)], t: [[2.5, 4], [2.5, 0]], w: [[-1.2, 5]] },
  // 17 introduce hostages: the white shirt blocks the floor line, go under the ledge
  { n: 'Tied Up', par: 2, a: [-3.5, 0], g: [[2.4, 6], [3.8, 6], [3.6, 0]], s: [ledge(0.6, R, 6)], h: [[1.0, 0]] },
  // 18 practise: the keg would take the hostage with it, pick them off
  { n: 'Hot Seat', par: 1, a: [-3.5, 0], g: [[1.1, 7], [3.9, 7]], s: [ledge(0.4, R, 7)], t: [[2.0, 7]], h: [[2.9, 7]] },
  // 19 twist: hostages in front, the goons only from above
  { n: 'Human Shield', par: 2, a: [-3.6, 0], g: [[2.5, 0], [3.8, 0], [3.4, 9]], s: [pillar(-0.2, 0.5, 3.0), ledge(1.6, R, 9)], h: [[1.2, 0], [2.3, 9]] },
  // 20 introduce glass: the window takes one bullet, the next goes through
  { n: 'Window', par: 2, a: [-3.5, 0], g: [[2.6, 0], [3.9, 0]], s: [[0.1, 3.2, 0.6, T]], gl: [[0.1, 0, 0.6, 3.2]] },
  // 21 practise: the keg behind the glass
  { n: 'Glass Keg', par: 2, a: [-3.5, 0], g: [[1.6, 7], [3.8, 7]], s: [ledge(0.4, R, 7), [0.4, 9.6, 0.8, T], [0.4, 0, 0.8, 6.4]], gl: [[0.4, 7, 0.8, 9.6]], t: [[2.7, 7]] },
  // 22 twist: the keg on the roof breaks the glass for you
  { n: 'Glass Box', par: 2, a: [-3.5, 0], g: [[1.9, 0], [3.6, 0], [3.0, 4]], s: [ledge(0.6, R, 4)], gl: [[0.6, 0, 1.0, 3.4]], t: [[1.3, 4]] },
  // 23 breather: five in a row
  { n: 'Saloon Brawl', par: 1, a: [-3.6, 0], g: [[-1.8, 0], [-0.4, 0], [1.0, 0], [2.4, 0], [3.8, 0]] },
  // 24 HARD test: glass, a hostage and a keg
  { n: 'Showdown', par: 3, hard: true, a: [-3.6, 0], g: [[1.6, 0], [2.2, 8], [4.05, 8]], h: [[2.7, 0]],
    s: [[0.2, 3.4, 0.6, T], ledge(1.6, R, 8)], gl: [[0.2, 0, 0.6, 3.4]], t: [[3.15, 8]] },

  // ---------------------------------------------------------------- world 3: Neon City (armoured goons, mirrors)
  // 25 introduce armour: shoot flat, the bullet comes back off the wall through him again
  { n: 'Heavyweight', par: 1, a: [-3.5, 0], G: [[3.6, 0]] },
  // 26 practise: the wall bounce doubles up on the ledge
  { n: 'Double Tap', par: 2, a: [-3.5, 0], G: [[2.2, 6]], g: [[3.8, 6], [3.4, 0]], s: [ledge(0.8, R, 6)] },
  // 27 twist: TNT doesn't care about helmets
  { n: 'Tin Cans', par: 2, a: [-3.5, 0], G: [[0.6, 8], [3.6, 8], [2.5, 0]], s: [ledge(-0.5, R, 8), pillar(1.0, 0.5, 3)], t: [[2.1, 8]] },
  // 28 practise: neither does a falling weight
  { n: 'Heavy Rain', par: 1, a: [-3.5, 0], G: [[2.8, 0]], g: [[-3.2, 9], [-0.2, 0]], s: [pillar(1.2, 0.5, 3.6), ledge(-R, -1.8, 9)], w: [[2.8, 5.5]] },
  // 29 introduce mirrors: straight up into the steel, it turns the shot over the wall
  { n: 'Mirror Mirror', par: 2, a: [-3.5, 0], g: [[3.4, 12], [2.6, 0]], s: [pillar(0, 0.6, 8), ledge(1.6, R, 12)], m: [[-2.5, 12.5, -1.5, 13.5]] },
  // 30 practise: two mirrors make a periscope into the bunker
  { n: 'Periscope', par: 2, a: [-3.5, 0], g: [[2.2, 0], [3.8, 0], [3.7, 7.5]], s: [[0.2, 0, 0.6, 10], ledge(2.8, R, 7.5)],
    m: [[-2.2, 13, -1.2, 14], [2.6, 14.2, 3.6, 13.2]] },
  // 31 twist: glass behind a mirror
  { n: 'Glass House', par: 2, a: [-3.5, 0], g: [[2.4, 10], [3.9, 10]], s: [ledge(1.0, R, 10), [1.0, 12.6, 1.4, T]], gl: [[1.0, 10, 1.4, 12.6]],
    m: [[-3.0, 11.0, -2.0, 12.0]] },
  // 32 breather: the mirror lays the shot along a whole ledge
  { n: 'Neon Lights', par: 1, a: [-3.6, 0], g: [[-1.2, 11], [0.4, 11], [2.0, 11], [3.6, 11]], s: [ledge(-2, R, 11)], m: [[-3.9, 11.6, -2.7, 12.8]] },
  // 33 HARD test: mirrors, armour and a hostage
  { n: 'Hall of Mirrors', par: 2, hard: true, a: [0, 8], G: [[-3.6, 9], [3.6, 9]], g: [[-3.4, 0], [3.4, 0]], h: [[2.2, 0]],
    s: [ledge(-R, -2.2, 9), ledge(2.2, R, 9), pillar(-1.3, 0.4, 2.6), pillar(1.3, 0.4, 2.6), ledge(-0.8, 0.8, 8)], m: [[-4.4, 3.4, -3.4, 4.4], [3.4, 4.4, 4.4, 3.4]] },
  // 34 practise everything: the rooftop
  { n: 'Rooftop', par: 1, a: [-3.6, 10], G: [[2.2, 0]], g: [[3.8, 0], [0.4, 0], [3.4, 6]], s: [ledge(-R, -2.4, 10), ledge(1.6, R, 6), pillar(1.2, 0.5, 2.6)], t: [[2.4, 6]], w: [[0.4, 4.0]] },
  // 35 twist: the vault (glass, armour, a hostage)
  { n: 'Vault', par: 2, a: [-3.6, 0], G: [[3.6, 0]], g: [[2.2, 0]], h: [[2.4, 8]], s: [[0.4, 3.0, 0.8, 8], ledge(0.4, R, 8)], gl: [[0.4, 0, 0.8, 3.0]],
    m: [[-3.2, 13.2, -2.2, 14.2]] },
  // 36 HARD final: the kingpin's office
  { n: 'Kingpin', par: 3, hard: true, a: [-3.6, 0], G: [[3.7, 11.5]], g: [[3.8, 0], [2.2, 11.5]], h: [[0.2, 0]],
    s: [ledge(-R, -1.8, 7), ledge(1.2, R, 11.5), pillar(-0.6, 0.5, 2.6), [1.2, 11.5, 1.5, 12.9]], t: [[2.95, 0]], gl: [[1.2, 12.9, 1.5, 15.6]], m: [[-1.8, 13.4, -0.6, 14.6]] },
];

// Capy Hop v2 — 30 hand-made crossings. One string per level, rows listed from the START row up to the FLAG row.
// Tokens (space separated):  G grass   G/-2,1 trees at columns   C>2x3 cars (dir > or <, speed 1-5, count)   T<2x2 trucks
//   W>2x4 river with logs (dir, speed 1-4, count)   P:-2,0,3 lily pads at columns   X5 / X5.3 rail (period s, phase s)
//   suffix *a,b  = oranges at columns (any row except rivers); columns run -4..4.
const L = (name, purpose, rows, o = {}) => ({ name, purpose, rows, creep: 0.2, ...o });
export const WORLDS = [
  { icon: '☀️', name: 'Sunny Streets', note: 'cars and trucks', sky: ['#9fdcff', '#d8f4ff'], hemi: 1.25 },
  { icon: '🌊', name: 'Lazy River', note: 'logs and lily pads', sky: ['#8fe0d6', '#d9fbf2'], hemi: 1.2 },
  { icon: '🚂', name: 'Rail Yard', note: 'listen for the bell', sky: ['#ffb98a', '#ffe6cf'], hemi: 1.05 },
];
// Longer crossings (cycle 2): levels 2-9 of each world run twice: the first half, a rest row, then a mirrored second half
// (directions swapped, columns flipped, a different orange) so the rhythm changes but the lessons repeat.
const mirror = (rows) => rows.split(' ').map((t) => {
  if (/^G\/|^P:/.test(t)) return t.replace(/-?\d+/g, (n) => String(-Number(n))).replace(/^(G\/|P:)-0/, '$1' + '0');
  if (/^[CTW][<>]/.test(t)) return t.replace(/[<>]/, (c) => (c === '<' ? '>' : '<')).replace(/\*.*/, '');
  if (/^G\*/.test(t) || /^X/.test(t)) return t.startsWith('G*') ? 'G' : t;
  return t;
}).join(' ');
const longer = (i) => i % 10 >= 1 && i % 10 <= 8 && i !== 1;
const RAW = [
  // ---- World 1: Sunny Streets (cars, trucks, trees, roadside oranges)
  L('Garden Gate', 'teach the hop: slow roads, a first orange', 'G G G*2 C>1x2 G C<1x2 G*-2 G C>1x2 G*1 C<1x2 G G', { creep: 0.08 }),
  L('Two Streets', 'two roads side by side: look both ways', 'G C>1x2 C<1x2 G*0 C>2x3 G C<1x2 C>1x2 G', { creep: 0.1 }),
  L('Count to Three', 'first crossings you can lose: three cars a lane', 'G C>1x3 G*-2 C<1x3 G C>1x3 C<1x3 G*3 C>2x3 G G', { creep: 0.14 }),
  L('Big Rigs', 'trucks are long: wait for the gap', 'G T>1x2 T<1x2 G C>2x3 G*-3 T>2x2 G C<2x3 T<1x2 G*2 G'),
  L('Tree Maze', 'trees block the way: sidestep early', 'G G/-1,0,1 G/-2,0,2 C>2x3 G/1,2,3 C<2x3 G/-3,-2,-1 C>2x3 G/0,1 G/-1,-2,2 T<2x2 G*0 G'),
  L('Orange Alley', 'roadside oranges tempt you into traffic', 'G C>2x3*-3 C<2x3 C>2x3*2 G C<2x3*-1 C>3x3 C<2x3*4 G C>2x3*0 G G'),
  L('Rush Hour', 'four lanes in a row: find the rhythm', 'G C>2x3 C>3x3 C<2x3 C<3x3 G*3 C>3x3 C<3x3 C>3x3 G C<3x3 C<3x3 G*-3 G'),
  L('Slow and Fast', 'lane speeds change: read each lane', 'G C>1x2 C<4x2*0 C>1x2 G C<3x3 T>2x2 G*-3 C>4x3 C<1x2 C>4x3 G T<3x2 C>2x3 G*2 G'),
  L('Truck Stop', 'trucks and trees: tight spots', 'G G/-1,0,1 T>2x2 G/-2,2 T<2x2*0 G/0 C>3x3 G*-3 T>3x2 T<3x2 G/-1,1 T>2x2 C<3x3 G*3 G'),
  L('Main Street', 'BOSS: the long gauntlet, rest on the grass', 'G C>2x3 C<2x3 G C>3x3 T<2x2 C>3x3 G*4 T>3x2 C<3x3 T>2x2 G/-2,2 C<4x3 C>3x3*0 C<3x3 G T<3x2 T>3x2 C>4x3 G*-4 C<3x3 C>3x3 C<4x3 G/-1,1 T>3x2 C<3x3 T>3x2 C>4x3 G*0 C<4x3 C>4x3 T<3x2 C>3x3 G G', { hard: true, creep: 0.24 }),
  // ---- World 2: Lazy River (logs, pads, sweep-off edges)
  L('Log Ride', 'teach logs: step on, ride, step off', 'G G W>1x4 G*0 W<1x4 G G', { creep: 0.08 }),
  L('Two Rivers', 'two rivers flowing opposite ways', 'G W>1x4 W<1x4 G*0 W>2x4 W<2x4 G W>1x4 W<2x4 W>1x4 G*3 G', { creep: 0.1 }),
  L('Lily Pond', 'lily pads sit still: hop pad to pad', 'G P:-1,1,3 P:1,2 P:1,0 G*0 P:0,-1,2 P:-1,2 P:-1,-2 G P:-2,0,2 P:0,1,3 P:3,2,1 G*3 G', { creep: 0.1 }),
  L('Log Hopper', 'ride a log, then another', 'G W>2x4 G*0 W<2x4 G*3 W>2x4 W<2x4 G W>2x4 G*-2 W<2x4 G'),
  L('Road Then River', 'cars, then logs: switch your timing', 'G C>2x3 G W>2x4 G C<2x3 W<1x4 G*-4 C>3x3 C<3x3 G W>2x4 W<2x4 G*0 G'),
  L('Stepping Stones', 'a pad path you plan row by row', 'G P:-2,0,3 P:0,3 P:-1,0,3 P:0,1 P:-1,1,2 P:1,3 G*0 P:2,3 P:3,4 P:3,2,1,0 P:0,-1 P:-1,-2,-3 P:-3,-2 G*-3 G'),
  L('Fast Water', 'quick logs: jump on, do not dawdle', 'G W>3x4 W<3x4 G*2 W>3x5 G W<3x4 W>3x4 W<3x5 G*-2 G'),
  L('Swept Away', 'logs carry you to the edge: sidestep back', 'G W>2x4 W<2x4 W>2x4 W<2x4 G*-3 W>2x4 W>3x4 W<2x4 G*0 W<2x4 W>2x4 G'),
  L('River Town', 'road, river and pads in one walk', 'G G/-1,1 C>3x3 G W<2x4 P:0,2 W>2x4 G/0 T<2x2 G*-3 C>3x3 W<2x4 G W>3x4 W<2x4 G/-2 W>2x4 W<2x4 G*0 G'),
  L('Great River', 'BOSS: five rivers, pads and a road', 'G W>1x4 W<2x4 G*3 C>3x3 W>2x4 P:-1,1,3 P:0,1 W<3x4 W>2x4 G C<3x3 T>2x2 W<2x4 P:1,2 P:0,1 W>3x4 W<2x4 G*-2 W>3x5 W<3x5 G C>3x3 C<3x3 G W>2x4 P:-1,0,1 P:1,3 W<3x4 W>3x4 G*0 W<3x5 W>3x5 W<3x4 G G', { hard: true, creep: 0.22 }),
  // ---- World 3: Rail Yard (trains with a bell, mixed with everything)
  L('First Train', 'listen: the bell rings before the train', 'G G X6 G*0 X7.2 G G', { creep: 0.08 }),
  L('Two Tracks', 'two tracks, two timings', 'G X5 X7.3 G*0 X6 X5.4 G X6.2 G*3 G', { creep: 0.1 }),
  L('Station Road', 'cars and a train in one crossing', 'G C>2x3 X6 C<2x3 X6.2 G*2 C>3x3 X7 C<2x3 G*-2 G'),
  L('Quick Rails', 'fast trains: rest between tracks', 'G X4 G*2 X4.5 G X4.1 G X5 X5.3 G*-3 X4 G'),
  L('Rail Road River', 'train, then logs, then train', 'G X6 W>2x4 G X5 W<2x4 G*-2 X6 C>3x3 G W>2x4 X5.2 G*0 G'),
  L('Night Shift', 'trucks and rails with trees to dodge', 'G G/-1,0 T>3x2 X5 C<3x3 X5.5 T>3x2*0 G/0,1 X5 T<3x2 G/-2,2 C>3x3 X6 G*3 G'),
  L('Crossing Chain', 'cars, trains, cars: hop on the beat', 'G C>3x3 X5 C<4x3 X5.3 C>3x3 G*-3 X4 C<3x3 X5 C>4x3 G X4.5 C<3x3 G*2 G'),
  L('Rail River Rail', 'water between two tracks', 'G X5 G W>2x4 W<2x4 P:-2,1 X5.4 G*3 W>3x4 P:0,1 X4.5 G W<2x4 G*-2 G'),
  L('Express', 'everything fast: stay calm', 'G C>4x3 X4 W>3x4 X4.4 C<4x3*0 T>3x2 G*-4 X4 C>4x3 W<3x4 X4.3 G C<4x3 T>4x2 G*3 G'),
  L('Grand Central', 'BOSS: roads, rails and rivers in a long run', 'G C>3x3 X5 C<3x3 G*0 W>2x4 W<3x4 P:-1,1 X4.5 G T>3x2 X5 C<4x3 G/-2,2 W<2x4 W>3x4 P:0,2 X4 C>4x3 X4.6 G*3 T<3x2 C>3x3 W>3x4 W<3x4 X4 G C>4x3 T<3x2 X4.8 C<4x3 G*-4 W>3x4 P:-1,0 P:0,1 W<3x4 X4.2 C>4x3 T<3x2 X4.5 G G', { hard: true, creep: 0.24 }),
];
export const LEVELS = RAW.map((lv, i) => {
  if (!longer(i)) return lv;
  const parts = lv.rows.split(' ');
  const first = parts.slice(0, -1).join(' '); // drop the final flag row's grass
  return { ...lv, rows: first + ' G ' + mirror(lv.rows).replace(/^G /, '') };
});

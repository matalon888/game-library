// Bricklash deep v2: 30 hand-made levels in 3 worlds. Each row is 10 cells.
//   . empty   1 2 3 brick with that many hits   # steel (never breaks)   X explosive (blows its 8 neighbours)
//   G gold brick (1 hit, +200, always drops a capsule)
// slide: row numbers that glide left and right.  net: free saves for a ball that falls (teaching levels only).
// hard: true shows the HARD badge.  Every level's purpose is the `why` line.
export const WORLDS = [
  { name: 'NEON ROW', sub: 'angles and hits', c: '#3dd6ff' },
  { name: 'BLAST FOUNDRY', sub: 'bombs and sliders', c: '#ff8a3d' },
  { name: 'COLD VAULT', sub: 'everything at once', c: '#9a7bff' },
];
export const LEVELS = [
  // ---- world 1: NEON ROW
  { name: 'First Light', why: 'learn the paddle: only 1-hit bricks, very forgiving', net: 30, rows: [
    '..........', '.11G11G11.', '.11111111.', '..111111..', '...1111...'] },
  { name: 'Two Hits', why: 'grey-white frame = 2 hits; gold gives a capsule', net: 8, rows: [
    '..........', '.2.2.2.2.2', '.11G11111.', '..111111..', '..........'] },
  { name: 'Steel Stripe', why: 'steel never breaks: bounce around it', net: 4, rows: [
    '..........', '.11111111.', '..........', '#...##...#', '..........', '.11111111.'] },
  { name: 'Smile', why: 'aim with the paddle edge to reach the eyes', rows: [
    '..........', '.11....11.', '.1G....G1.', '..........', '1........1', '.1......1.', '..111111..'] },
  { name: 'Pillars', why: 'steel pillars make lanes: shoot up a lane', net: 4, rows: [
    '1G1.1G1.1G', '#1#1.1#1#1', '#1#1G1#1#1', '1111111111', '..........', '..........'] },
  { name: 'Checker Bloom', why: 'alternate 1 and 2 hit bricks, ball ricochets fast', rows: [
    '1212121212', '2121212121', '1212G21212', '2121212121', '1212121212'] },
  { name: 'The Castle', why: 'HARD: steel walls, find the gate to reach the gold', hard: true, rows: [
    '2.2.2.2.2.', '##.####.##', '#11111111#', '#1G2112G1#', '#11111111#', '###.##.###', '..........'] },
  { name: 'Capsule Rain', why: 'breather: gold everywhere, try every power-up', rows: [
    '....11....', '...1GG1...', '..11GG11..', '.11GGGG11.', '1111GG1111', '..........'] },
  { name: 'Stairs', why: 'a diagonal wall: angle the ball along it', rows: [
    '2222222211', '111111111.', '11111111..', '1111111...', '111111....', '11111.....', '#########.'] },
  { name: 'Gatekeeper', why: 'boss: first 3-hit core inside a ring', hard: true, rows: [
    '..........', '.11111111.', '.1######1.', '.1#3333#1.', '.1#3G33#1.', '.1#3333#1.', '.1#....#1.', '.11111111.'] },
  // ---- world 2: BLAST FOUNDRY (explosive X, sliding rows)
  { name: 'First Boom', why: 'one explosive clears a whole blob', net: 1, rows: [
    '..........', '..111111..', '.11111111.', '.111X1111.', '.11111111.', '..111111..'] },
  { name: 'Fuse Line', why: 'bombs next to bombs chain: hit the end one', rows: [
    '..........', '1X1X1X1X1X', '2222222222', '..........', '1111111111'] },
  { name: 'Sliders', why: 'two rows glide; time your shot', slide: [1, 3], rows: [
    '..........', '.11111111.', '..........', '.11111111.', '..........', '2.2.2.2.2.'] },
  { name: 'Shelf and Slide', why: 'sliding 2-hit row under a steel shelf', slide: [4], rows: [
    '####..####', '..........', '.G.G..G.G.', '..........', '.22222222.', '..........', '1111111111'] },
  { name: 'Bomb Pockets', why: 'steel pockets with a bomb inside: hit it from a gap', rows: [
    '#.##..##.#', '#2##2222##', '#2XX22XX2#', '#2##2222##', '#.##..##.#', '..........'] },
  { name: 'Tight Chain', why: 'HARD: bombs ring a 3-hit core, one bounce too many', hard: true, rows: [
    '..........', '.XXXXXXXX.', '.X333333X.', '.X3G33G3X.', '.X333333X.', '.XXXXXXXX.', '..........'] },
  { name: 'Big Bang', why: 'breather: one lucky bomb pops the field', rows: [
    '1111111111', '1111111111', '11111X1111', '111111G111', '1111111111', '1111111111'] },
  { name: 'Zipper', why: 'rows slide against each other, find the hole', slide: [1, 2, 3, 4], rows: [
    '..........', '.11111111.', '..222222..', '.11111111.', '..222222..', '..........', '2222222222'] },
  { name: 'Cross Fire', why: 'a 3-hit cross, bombs at the tips', rows: [
    '....XX....', '....33....', '....33....', 'X33333333X', 'X33G33G33X', '....33....', '....33....', '....XX....'] },
  { name: 'The Furnace', why: 'boss: bomb eyes, sliding mouth, gold heart', hard: true, slide: [6], rows: [
    '..........', '.33333333.', '.3X3333X3.', '.33333333.', '..33GG33..', '..........', '..11111111', '..........'] },
  // ---- world 3: COLD VAULT (everything at once)
  { name: 'Vault Door', why: 'steel box, two thin gaps, 2-hit gold inside', rows: [
    '##########', '#11111111#', '#11G11G11#', '#11111111#', '###....###', '..........'] },
  { name: 'Lattice', why: 'a mesh of 3-hit and 1-hit: find the weak knots', rows: [
    '3131313131', '1313131313', '3131G13131', '1313131313', '3131313131'] },
  { name: 'Slide Maze', why: 'sliders between steel ledges: wait for the gap', slide: [2, 4], rows: [
    '1111111111', '#..####..#', '..2222222.', '#..####..#', '..1111111.', '#..####..#', '..........'] },
  { name: 'Alley', why: 'a narrow lane of 3 hits with bombs on the sides', rows: [
    'X........X', 'X..3333..X', 'X..3333..X', 'X..3G33..X', 'X..3333..X', 'X..3333..X', 'X........X'] },
  { name: 'Frostbite', why: 'HARD: steel teeth, 3-hit roof, slide in the middle', hard: true, slide: [3], rows: [
    '3333333333', '#.#.#.#.#.', '..........', '.22G22G22.', '..........', '#.#.#.#.#.', '1111111111'] },
  { name: 'Snow Day', why: 'breather: bombs and gold in soft bricks', rows: [
    '..........', '1X1111X111', '1111G11111', '11X1111X11', '1111111111', '1G1111G111'] },
  { name: 'Pendulum', why: 'three sliding rows, speed and bombs', slide: [1, 3, 5], rows: [
    '..........', '..XXXXXX..', '..........', '.33333333.', '..........', '..22222222', '..........', '1111111111'] },
  { name: 'Hourglass', why: 'diagonal steel funnels the ball to the bomb', rows: [
    '3333333333', '#33333333#', '.#333333#.', '..#3XX3#..', '...#33#...', '..#3GG3#..', '.#333333#.', '#33333333#'] },
  { name: 'Last Gate', why: 'HARD: everything, thin gaps, bomb behind steel', hard: true, slide: [2], rows: [
    '#.##..##.#', '#3##XX##3#', '..333333..', '#.##..##.#', '#2##GG##2#', '#.########', '1111111111'] },
  { name: 'Vault Heart', why: 'final boss: sliding heart of 3-hit bricks', hard: true, slide: [0, 6], rows: [
    '.33....33.', '3333..3333', '3G333333G3', '3333333333', '.33333333.', '..333333..', '...3XX3...', '....33....'] },
];
export const N = LEVELS.length;
// make every row exactly 10 cells
for (const L of LEVELS) L.rows = L.rows.map(r => (r + '..........').slice(0, 10));

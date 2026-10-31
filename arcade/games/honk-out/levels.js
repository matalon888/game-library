// Honk Out! deep v2: 30 hand-drawn car parks in 3 worlds. Rows: '.' empty, '#' cone, letters = vehicles (lowercase car, UPPERCASE van, 3 cells = bus).
// Legend letter:dir:colour[:zN]  dir u/d/l/r = the way it leaves; v/h = taxi (leaves by whichever end is clear); colour r b y g p o k c, '*' = rainbow;
// zN = sleepy: wakes once N vehicles have left. mix = how scrambled the passenger queue is (frozen in bake.js, qa/bake.mjs). hard = HARD level.
export const WORLDS = [
  { name: 'Sunny Lot', icon: '☀️', note: 'cars, vans, buses, taxis' },
  { name: 'Rush Hour', icon: '🚦', note: 'sleepy cars, rainbow buses' },
  { name: 'Harbour Night', icon: '🌙', note: 'four spots only' },
];
const A = (purpose, rows, leg, o = {}) => ({ purpose, rows, leg, ...o });
export const LEVELS = [
  // ---- World 1: Sunny Lot
  A('all roads clear: tap any car', ['a.b', 'a.b', 'cc.'], 'a:u:r b:u:b c:l:y', { mix: 0, tag: 'TAP A CAR TO DRIVE IT OUT' }),
  A('one car blocks another: free it first', ['a.bb', 'a.cc', 'dd..'], 'a:u:r b:r:b c:l:r d:r:b', { mix: 0 }),
  A('first level you can lose: colours jam the spots', ['aabb', 'c..d', 'c..d', 'eeff'], 'a:l:r b:r:b c:u:b d:u:r e:l:y f:r:y', { mix: 4 }),
  A('vans carry 6', ['AAcc.', 'd.ee.', 'd.ff.', 'gg.hh'], 'A:l:r c:r:b d:u:y e:r:r f:r:b g:l:y h:r:g', { mix: 4, tag: 'VANS CARRY 6' }),
  A('two stacks: unpeel the columns', ['ac.eg', 'ac.eg', 'bd.fh', 'bd.fh'], 'a:u:r b:u:b c:d:y d:d:g e:u:b f:u:r g:d:g h:d:y', { mix: 5 }),
  A('the first bus: 10 riders', ['bbb.a', 'c...a', 'c.dd.', 'c..ee'], 'b:r:r a:u:b c:d:y d:r:r e:r:b', { mix: 4, tag: 'BUSES CARRY 10' }),
  A('bus, vans and a long chain', ['AAbbb', 'c...d', 'c.EEd', 'f...g', 'fhhhg'], 'A:l:r b:r:b c:d:y d:u:g E:r:p f:d:r g:d:b h:l:y', { mix: 6 }),
  A('taxi: leaves by whichever end is clear', ['aab.c', '.tb.c', '.t..d', 'ee..d', '..ff.'], 'a:l:r b:u:b c:u:y t:v:g d:d:b e:l:y f:r:r', { mix: 5, tag: 'TAXI: EITHER END' }),
  A('taxis and cones: walls pick the exit', ['.a.b.', '.a.b.', '.tt.c', '.d#.c', '.d..e', 'ffgge'], 'a:u:r b:u:y t:h:b c:u:g d:d:r f:l:y g:l:b e:d:g', { mix: 6 }),
  A('HARD: the big jam, five colours', ['aabbcc', 'd....e', 'dg..he', 'fgttho', 'fiijjo', 'kkllmm'], 'a:l:r b:u:b c:r:y d:u:g e:u:p f:d:r g:u:y t:h:b h:u:g i:l:p j:r:r k:l:b l:d:y m:r:g o:d:p', { mix: 7, hard: true }),
  // ---- World 2: Rush Hour
  A('sleepy: a car that wakes after 2 others leave', ['aabb.', 'cs..d', 'cs..d', '.eeff'], 'a:l:r b:r:b s:u:y:z2 c:d:g d:u:r e:l:b f:r:g', { mix: 4, tag: 'SLEEPY WAKES AFTER 2 LEAVE' }),
  A('sleepy at the back of a stack', ['ab.cd', 'ab.cd', 'es.fg', 'es.fg'], 'a:u:r b:u:b e:d:y s:d:g:z3 c:u:g f:d:r d:u:y g:d:b', { mix: 5 }),
  A('two sleepers, one bus', ['sss.a', 'b...a', 'b.cc.', 'b..dd'], 's:r:r:z2 a:u:b b:d:y c:r:g d:r:b', { mix: 5 }),
  A('sleepy vans in the corner', ['AAbb.', 'c..dd', 'c.EEh', 'ffg.h', '..gzz'], 'A:l:r b:r:b c:u:y d:r:g E:r:r f:r:y g:d:g z:r:b:z3 h:d:r', { mix: 6 }),
  A('sleepy taxi: wakes late, goes either way', ['.aabb', 'c.t.d', 'c.t.d', 'eeffg', '....g'], 'a:l:r b:r:b c:u:g t:v:y:z3 d:u:r e:l:b f:r:g g:d:y', { mix: 6 }),
  A('RAINBOW BUS: takes whoever is next', ['abbb.', 'a...c', 'd.rrr', 'd.e.c', 'ffe..'], 'a:u:r b:r:b c:u:g d:d:y r:r:*  e:d:b f:l:r', { mix: 7, tag: 'RAINBOW BUS TAKES ANYONE' }),
  A('rainbow rescue: save it for the jam', ['aabbc', 'd...c', 'd.ee.', 'frrrg', 'f...g'], 'a:l:r b:r:b c:u:y d:u:g e:r:r r:r:*  f:d:b g:d:y', { mix: 8 }),
  A('rainbow, sleepers and a taxi', ['aabbcc', 'd.t.ez', 'd.t.ez', 'frrrgg', 'f..hh.'], 'a:l:r b:r:b c:r:y d:u:g t:v:r e:u:b z:d:y:z3 f:d:b r:r:* g:r:g h:r:r', { mix: 8 }),
  A('breather: wide open lot, big combos', ['AAbbb.', '.cc..d', 'ee.ff.', 'g..hhd', 'gii.jj'], 'A:l:r b:r:b c:l:y d:u:g e:l:r f:r:b g:d:y h:r:g i:r:b j:r:r', { mix: 3 }),
  A('HARD: sleepers guard the rainbow bus', ['aabbcc', 'ds...e', 'dsrrre', 'f...gh', 'fiiigh', 'kkllmm'], 'a:l:r b:r:b c:r:y d:u:g e:u:r s:u:y:z4 r:r:* f:d:b i:l:b g:d:y h:d:r k:l:y l:d:r m:r:b', { mix: 8, hard: true }),
  // ---- World 3: Harbour Night (four parking spots)
  A('four spots: every car counts', ['aabb', 'c..d', 'c..d', 'eeff'], 'a:l:r b:r:b c:u:y d:u:g e:l:b f:r:y', { mix: 4, slots: 4, tag: 'ONLY 4 SPOTS' }),
  A('four spots, two buses', ['bbb.a', 'c...a', 'c.ddd', 'c.e.f', '..e.f'], 'b:r:r a:u:b c:d:y d:r:g e:d:b f:d:y', { mix: 5, slots: 4 }),
  A('four spots and sleepers', ['aabbs', 'c...s', 'c.dd.', 'eef.g', '..f.g'], 'a:l:r b:r:b s:u:y:z2 c:d:g d:r:r e:l:y f:d:b g:d:g', { mix: 6, slots: 4 }),
  A('four spots, stacks and a taxi', ['ab.cd', 'ab.cd', 'ettfg', 'e..fg'], 'a:u:r b:u:b e:d:y t:h:g c:u:g f:d:r d:u:y g:d:b', { mix: 6, slots: 4 }),
  A('four spots, rainbow to the rescue', ['aabbc', 'd...c', 'drrrg', 'e...g', 'ehhff'], 'a:l:r b:r:b c:u:y d:u:g r:r:*  e:d:r g:d:b h:r:y f:r:g', { mix: 7, slots: 4 }),
  A('long vans, four spots', ['AAbbb.', 'c...dd', 'cEE.ff', 'gg.hhi', '..jj.i'], 'A:l:r b:r:b c:u:y d:r:g E:r:r f:r:b g:l:y h:r:g i:d:r j:l:b', { mix: 6, slots: 4 }),
  A('sleepers and rainbow, four spots', ['sabb.z', 'sacc.z', 'dtt.ee', 'd.rrr.', 'ghh.if', 'g.jjif'], 's:u:r:z2 a:u:b b:r:y c:r:g z:u:b:z3 d:u:r t:h:y e:r:g r:r:* g:d:y h:l:r i:d:g f:d:b j:l:b', { mix: 8, slots: 4 }),
  A('breather: seven neat rows', ['aabbcc', 'dd.ee.', 'ffgghh', '.ii.jj'], 'a:l:r b:r:b c:r:y d:l:g e:r:r f:l:b g:r:y h:r:g i:l:r j:r:b', { mix: 3, slots: 4 }),
  A('everything at once', ['aabbccz', 'd.t.erz', 'dst.er.', 'fs..gr.', 'f.hhgii', 'jj.kkll', 'nn.oopp'], 'a:l:r b:r:b c:r:y z:u:g:z2 d:u:y e:u:g t:v:r s:d:b:z3 r:d:* f:d:r g:d:y h:l:b i:r:g j:l:y k:r:r l:r:b n:l:y o:r:g p:r:r', { mix: 6, slots: 4 }),
  A('HARD: the harbour jam', ['aabbccz', 'd.t.erz', 'dst.er.', 'fs..gr.', 'f.hhgii', 'jj.kkll', 'nn.oopp'], 'a:l:y b:r:r c:r:b z:u:r:z3 d:u:g e:u:y t:u:b s:d:g:z2 r:d:* f:d:b g:d:r h:r:y i:r:g j:l:r k:r:b l:r:y n:l:g o:r:r p:r:b', { mix: 9, slots: 4, hard: true }),
];

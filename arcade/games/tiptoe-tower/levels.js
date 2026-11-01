// Tiptoe Tower v2: hand-made levels (3 worlds × 12) + the solver that sets each level's star steps on the podium.
// A level is a list of rows, run top to bottom. A row is three lane tokens (left middle right) or one full-width token.
//   lane tokens:  .  empty      sN  N shoes in a column (+1 heel each)     gN  N gems      S  golden shoe (+3 heels)
//                 wN lane wall N bricks tall (costs N heels; fewer = BONK)  +N / -N / xN  gate (add, lose, multiply heels)
//                 cN snip bar: a laser at heel height N, cuts a taller stack down to N
//   full width:   WN wall across the runway   RN rails: the splits need N heels   MN a wall block N tall that slides lane to lane
// No imports: node runs this file too (qa/levels.mjs).

export const WORLDS = [
  { name: 'Rooftop Runway', sky: ['#3fa9ff', '#c4ecff', '#ff4fa3'] },
  { name: 'Neon Boulevard', sky: ['#ff7eb6', '#ffe0ef', '#c13aff'] },
  { name: 'Starlight Skyline', sky: ['#5b4bd8', '#ffd1f0', '#25c2d9'] },
];
export const PER_WORLD = 12;

export const LEVELS = [
  // ---------------------------------------------------------------- world 1: Rooftop Runway (shoes, walls, rails, lane walls, golden shoe)
  { n: 'First Strut', p: "can't lose: shoes in every lane, a 1-brick step, an easy splits; won in ~12 s",
    rows: ['s3 s5 s3', 'g3 . g3', 'W1', 's2 s3 s2', 'R2'] },
  { n: 'Pick a Lane', p: 'first decision: shoes or gems; every path still clears the rail',
    rows: ['s3 s3 s3', 'x2 s2 +4', 'g4 s4 g4', 'w3 s2 w3', 'W3', 'g3 s3 g3', 's2 s5 s2', 'W4', 'R4'] },
  { n: 'Mind the Bricks', p: 'first level you can lose: lane walls, the free lane has shoes',
    rows: ['s4 s4 s4', 'w3 s2 w3', 'g3 . s3', 'W3', '. s4 g3', 's3 . .', 'w5 w5 s2', 'R7'] },
  { n: 'Long Legs', p: 'practise the splits: a longer rail needs a taller stack',
    rows: ['s5 . s3', '. g4 .', 's2 s4 s2', 'R4', 'g3 s3 g3', 'W2', 's4 . s4', 'R8'] },
  { n: 'Zigzag', p: 'shoe columns jump lane to lane: steer early',
    rows: ['s4 . .', '. s4 .', '. . s4', '. s4 .', 'w4 g4 w4', 'W3', 's3 . s5', 'R8'] },
  { n: 'Gold Rush', p: 'introduce the golden shoe (+3): it sits behind a lane wall',
    rows: ['s5 s3 s3', 'w2 . .', 'S . g3', 's2 s4 s2', 'W3', '. S .', 'g4 s2 g4', 'R8'] },
  { n: 'Side Step', p: 'lane walls on alternating sides; gems tempt you into the short lane',
    rows: ['s4 s4 s4', 'w3 . g3', 's3 . w3', 'g4 s3 .', 'w4 w4 .', '. . s4', 'W2', 's3 S s3', 'R9'] },
  { n: 'Spend to Win', p: 'twist: the wall is optional — pay 4 to reach the big column, or keep heels for the rail',
    rows: ['s5 s4 s5', 'w4 . .', 's6 g4 s2', 'W2', 'g3 s3 g3', 'R5', 's2 s4 s2', 'W3', 'R4'] },
  { n: 'Twin Rails', p: 'two rails back to back with a short ground strip between',
    rows: ['s5 s5 s5', 'g3 s2 g3', 'R4', 's3 . s3', 'R5', 'W2', 's4 g3 s4', 'w3 . w3', 'R5'] },
  { n: 'The Tall Wall', hard: true, p: 'HARD: a 7-brick wall near the end; only the greedy line has enough',
    rows: ['s4 s3 s4', 'w2 . w2', 'g3 s4 g3', 's3 . S', 'W3', 's4 s2 s4', 'w5 g3 w5', 's3 . s3', 'W7', 'R2'] },
  { n: 'Victory Lap', p: 'breather: shoes everywhere, a long gem rail, a huge podium climb',
    rows: ['s5 s5 s5', 'g4 S g4', 's4 s4 s4', 'W2', 'g5 g5 g5', 'R6', 's4 s4 s4'] },
  { n: 'Roof Boss', hard: true, p: 'HARD: everything from world 1; lane walls hide the shoes, two rails, a 6 wall',
    rows: ['s4 . s4', 'w3 s3 w3', '. S .', 'w4 . w4', 's2 s5 s2', 'R6', 'g3 s3 g3', 'w6 . .', 's5 . s3', 'W6', 's3 s3 s3', 'R5'] },

  // ---------------------------------------------------------------- world 2: Neon Boulevard (gates +N / -N, ×2, snip bars)
  { n: 'Neon Gates', p: 'introduce +N gates: walk through the bigger number',
    rows: ['s3 s3 s3', '+2 +5 +2', 'W2', 's2 . s2', '+3 . +3', 'R5'] },
  { n: 'Watch the Minus', p: 'practise: a -3 gate guards the best shoes; the other lane is safe but small',
    rows: ['s4 s4 s4', '-3 . +2', 's6 g3 s2', 'W3', '+4 -2 +1', 's3 s3 s3', 'R6'] },
  { n: 'Double Up', p: 'introduce ×2: bank shoes first, then double them',
    rows: ['s4 s2 s4', 's2 s4 s2', 'x2 g3 +2', 'W4', 's3 . s3', 'R6'] },
  { n: 'Late Doubler', p: 'twist: ×2 at the very end is worth more, but the lane before it has a wall',
    rows: ['s4 s4 s4', '+3 g4 +3', 'w4 . .', 'x2 s3 +4', 'W3', 's2 s4 s2', '. g4 x2', 'R8'] },
  { n: 'Gate Maze', p: 'gates three wide every few steps: count before you steer',
    rows: ['s3 s3 s3', '+2 -1 +4', '-2 +5 +1', 'W3', 'x2 +3 -3', 's3 g3 s3', '+1 +1 +6', 'R8'] },
  { n: 'Snip Snap', p: 'introduce the snip bar: it cuts your stack down; one lane has none',
    rows: ['s5 s5 s5', 'c2 . c2', 's3 g3 s3', 'W3', 'c3 s4 c3', 's3 s3 s3', 'R5'] },
  { n: 'Snip Then Stack', p: 'practise: take the snip early when the shoes after it are worth more',
    rows: ['s4 s4 s4', 'c1 . .', 'S s3 g3', 's6 . s2', 'x2 . +3', 'W4', 'R9'] },
  { n: 'Laser Row', p: 'snip bars on every lane: pick the one that cuts the least',
    rows: ['s6 s6 s6', 'c3 c5 c2', 's2 s3 s4', 'W3', 'c4 c4 c6', '+2 +4 +2', 'R6'] },
  { n: 'Doubler Gauntlet', hard: true, p: 'HARD: ×2 behind snips and walls, a -4 trap, a 9 wall',
    rows: ['s4 s3 s4', 'x2 . c2', 's3 s3 s3', 'w5 +4 -4', 'x2 g4 +3', 's3 . s3', 'W9', 'c6 . c4', 's4 s4 s4', 'R7'] },
  { n: 'Neon Cruise', p: 'breather: big +gates, a ×2, a long gem rail',
    rows: ['s4 s4 s4', '+5 +3 +5', 'g4 g4 g4', 'x2 x2 x2', 'R10', 'g5 g5 g5', 's3 s3 s3'] },
  { n: 'Choose Your Math', p: 'twist: +6 now or ×2 later; ×2 wins only if you also take the shoes in between',
    rows: ['s3 s3 s3', '+6 . .', 's2 s5 s2', 'W2', '. . x2', 's4 g3 s4', 'W4', 'R9'] },
  { n: 'Boulevard Boss', hard: true, p: 'HARD: gates, snips, lane walls and two rails; one exact line clears it',
    rows: ['s4 s4 s4', '-2 x2 +2', 'w5 . c3', 's4 s2 s4', 'W4', '+3 -3 x2', 'c5 . w6', 's3 s4 s3', 'R8', 'g4 . g4', 'W5', 'R6'] },

  // ---------------------------------------------------------------- world 3: Starlight Skyline (sliding walls + everything)
  { n: 'Sliding Bricks', p: 'introduce the sliding wall: wait for it to pass, or walk through it tall',
    rows: ['s5 s5 s5', 'M3', 's3 g3 s3', 'M2', 's4 s4 s4', 'R6'] },
  { n: 'Rush Hour', p: 'practise: two sliding walls in a row, shoes between them',
    rows: ['s4 s4 s4', 'M4', '. s4 .', 'M4', 'g3 s3 g3', 'W3', 's3 . s3', 'R6'] },
  { n: 'Slide and Double', p: 'a sliding wall guards the ×2 lane',
    rows: ['s4 s3 s4', 'M5', 'x2 +2 +2', 's3 g3 s3', 'W4', 'M3', 's2 s4 s2', 'R8'] },
  { n: 'Starlit Rails', p: 'three rails, the last one long; snip bars between',
    rows: ['s5 s5 s5', 'R5', 's3 s3 s3', 'c4 . c6', 'R6', 'S . S', '+3 +2 +3', 'R9'] },
  { n: 'Cut and Climb', p: 'twist: a snip lane hides a golden shoe and a ×2; the clean lane is slow',
    rows: ['s6 s6 s6', 'c2 . .', 'S s2 g3', 'x2 s2 .', 'M4', 's4 s4 s4', 'W5', 'R8'] },
  { n: 'Signal Lights', p: 'sliding walls over gates: timing plus counting',
    rows: ['s4 s4 s4', '+4 -2 +2', 'M5', 's3 s3 s3', 'x2 . +5', 'M6', 'g4 s3 g4', 'R10'] },
  { n: 'Neon Stairs', p: 'walls climb 2,3,4,5: stack faster than they grow',
    rows: ['s5 s5 s5', 'W2', 's4 s5 s4', 'W3', 's5 s6 s5', 'W4', 's5 S s5', 'W5', 's3 s4 s3', 'R6'] },
  { n: 'The Long Night', hard: true, p: 'HARD: long level, every element, an 8 wall and a 10 rail',
    rows: ['s4 s4 s4', 'w3 c2 +4', 's3 s3 S', 'M5', '-3 x2 +3', 's4 g3 s4', 'W8', 'c5 s3 .', 'M4', 's3 s3 s3', '+3 . +4', 'R10'] },
  { n: 'Moonwalk', p: 'breather: shoes and gems everywhere, one slow sliding wall, a giant podium',
    rows: ['s5 s5 s5', 'g5 g5 g5', 'M2', 's4 S s4', 'x2 x2 x2', 'R10', 'g5 g5 g5'] },
  { n: 'Star Choice', p: 'risk lane vs safe lane all the way: gems on the risky side',
    rows: ['s4 s4 s4', 'g5 . w4', 'c3 s3 S', 's4 . s4', 'M5', 'g4 +3 x2', 'w6 . .', 's3 s3 s3', 'R9'] },
  { n: 'Skyline Sprint', p: 'fast mixed run: short rows, decisions every second',
    rows: ['s3 s3 s3', '+2 . +3', 'w3 s3 .', 'M3', 's2 s4 s2', 'c4 . +2', 'W3', 's3 g3 s3', 'x2 . .', 'R9'] },
  { n: 'Tower Top', hard: true, p: 'HARD finale: two sliding walls, a ×2 behind a snip, a 10 wall, a 9 rail',
    rows: ['s5 s4 s5', 'w4 . c3', 'S s3 S', 'M5', '+4 -3 +2', 's4 s4 s4', 'c4 x2 .', 'M6', 's4 s3 s4', 'W10', 's4 s4 s4', 'R9'] },
];

// lane token → effect on heels h (null = BONK)
export function apply(tok, h) {
  if (!tok || tok === '.') return h;
  const c = tok[0], n = +tok.slice(1) || 0;
  if (c === 's') return Math.min(60, h + n);
  if (c === 'S') return Math.min(60, h + 3);
  if (c === 'g') return h;
  if (c === 'w') return h >= n ? h - n : null;
  if (c === '+') return Math.min(60, h + n);
  if (c === '-') return Math.max(0, h - n);
  if (c === 'x') return Math.min(60, h * n);
  if (c === 'c') return Math.min(h, n);
  return h;
}
export const isFull = row => !row.includes(' ');

/** best heels at the podium (max over every lane choice), the worst heels a line can still finish with, gems on the best
 *  line. Lane changes between rows are free (rows are far enough apart); a sliding wall is dodged by timing. */
export function solve(rows) {
  let set = new Map([[0, 0]]);   // heels → most gems with that many heels
  for (const row of rows) {
    const next = new Map(), put = (h, g) => { if (h !== null && (!next.has(h) || next.get(h) < g)) next.set(h, g); };
    if (isFull(row)) {
      const c = row[0], n = +row.slice(1);
      for (const [h, g] of set) {
        if (c === 'W') put(h >= n ? h - n : null, g);
        else if (c === 'R') put(h >= n ? h : null, g + 4);
        else put(h, g);   // M: dodge it
      }
    } else {
      for (const tok of row.split(' ')) for (const [h, g] of set) put(apply(tok, h), g + (tok[0] === 'g' ? +tok.slice(1) : 0));
    }
    set = next;
    if (!set.size) return { ok: false, best: 0, worst: 0, gems: 0 };
  }
  const hs = [...set.keys()];
  const best = Math.max(...hs);
  return { ok: true, best, worst: Math.min(...hs), gems: set.get(best) };
}

/** podium steps that earn the 2nd and 3rd star (step i = multiplier x(1 + i/10)); 1 star = reach the podium */
export function starSteps(best) {
  const top = Math.min(29, best);
  const s3 = Math.max(2, top - 1 - Math.floor(top / 10));
  const s2 = Math.max(1, Math.round(s3 * 0.55));
  return [s2, s3];
}

/** after level 36: a fresh level per number from the unlocked elements, scaled by the tuner's k like v1's walls */
export function genLevel(lv, R, k = 1) {
  const pick = a => a[Math.floor(R() * a.length)];
  const rows = ['s4 s4 s4'];
  let n = 9 + Math.min(5, Math.floor((lv - 36) / 4));
  for (let i = 0; i < n; i++) {
    const t = pick(['shoes', 'shoes', 'gates', 'lane', 'wall', 'snip', 'slide', 'rail']);
    const ln = () => Math.floor(R() * 3);
    const three = f => [0, 1, 2].map(f).join(' ');
    if (t === 'shoes') { const a = ln(); rows.push(three(l => l === a ? 's' + (4 + Math.floor(R() * 3)) : R() < 0.5 ? 's' + (2 + Math.floor(R() * 2)) : 'g3')); }
    else if (t === 'gates') rows.push(three(() => pick(['+2', '+3', '+4', '-2', '-3', 'x2', '+5'])));
    else if (t === 'lane') { const free = ln(); rows.push(three(l => l === free ? 's2' : 'w' + Math.max(1, Math.round((3 + Math.floor(R() * 4)) * k)))); }
    else if (t === 'wall') rows.push('W' + Math.max(1, Math.round((2 + Math.floor(R() * 4)) * k)));
    else if (t === 'snip') { const free = ln(); rows.push(three(l => l === free ? '.' : 'c' + (2 + Math.floor(R() * 4)))); }
    else if (t === 'slide') rows.push('M' + Math.max(2, Math.round((3 + Math.floor(R() * 3)) * k)));
    else rows.push('R' + (4 + Math.floor(R() * 5)));
    if (i % 2) rows.push(three(() => 's' + (2 + Math.floor(R() * 3))));
  }
  rows.push('R' + (5 + Math.floor(R() * 4)));
  // keep it clearable: lower walls/rails until the solver finds a line
  for (let tries = 0; tries < 40 && !solve(rows).ok; tries++) {
    const i = rows.findIndex((r, j) => j > 0 && /^[WRM]\d/.test(r) && +r.slice(1) > 1 && R() < 0.5);
    if (i > 0) rows[i] = rows[i][0] + (+rows[i].slice(1) - 1); else rows.splice(1, 0, 's4 s4 s4');
  }
  return { n: 'Encore ' + (lv - 36), p: 'generated', rows };
}

/** the lane line that reaches the best heels (QA bot + in-game bot): one entry per row, a lane 0-2 or null (full row) */
export function solvePath(rows) {
  let set = new Map([[0, { g: 0, path: [] }]]);
  for (const row of rows) {
    const next = new Map(), put = (h, g, path) => { if (h !== null && (!next.has(h) || next.get(h).g < g)) next.set(h, { g, path }); };
    if (isFull(row)) {
      const c = row[0], n = +row.slice(1);
      for (const [h, v] of set) put(c === 'W' ? (h >= n ? h - n : null) : c === 'R' ? (h >= n ? h : null) : h, v.g + (c === 'R' ? 4 : 0), [...v.path, null]);
    } else row.split(' ').forEach((tok, l) => { for (const [h, v] of set) put(apply(tok, h), v.g + (tok[0] === 'g' ? +tok.slice(1) : 0), [...v.path, l]); });
    set = next;
    if (!set.size) return null;
  }
  const best = Math.max(...set.keys());
  return set.get(best).path;
}

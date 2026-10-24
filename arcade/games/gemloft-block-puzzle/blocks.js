// Gemloft board logic: 8×8 grid, the piece library, placing + clearing rows/columns, the fair dealer (three pieces at a
// time, at least one always fits), level generation for adventure / daily / classic, and a placement heuristic for the
// hint booster and the QA bot. Pure logic, no three.js.
export const N = 8;
export const COLORS = 7;            // ruby, sapphire, emerald, citrine, amethyst, rose, aqua (view.js has the palette)
export const GEMS = ['heart', 'drop', 'star', 'leaf', 'amber'];

// ---------------------------------------------------------------- pieces
const BASE = {
  dot: ['#'], i2: ['##'], i3: ['###'], i4: ['####'], i5: ['#####'],
  o2: ['##', '##'], o3: ['###', '###', '###'], r23: ['###', '###'],
  c3: ['##', '#.'], l4: ['#.', '#.', '##'], t4: ['###', '.#.'], s4: ['.##', '##.'], bigL: ['###', '#..', '#..'],
};
const SIZE = { dot: 's', i2: 's', i3: 's', c3: 's', i4: 'm', o2: 'm', l4: 'm', t4: 'm', s4: 'm', i5: 'l', o3: 'l', r23: 'l', bigL: 'l' };
const norm = cells => { const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])); return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); };
const key = cells => cells.map(c => c.join(',')).join(';');
export const SHAPES = [];
for (const [id, rows] of Object.entries(BASE)) {
  let cells = []; rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && cells.push([x, y])));
  const seen = new Set();
  for (const mirror of [false, true]) for (let r = 0; r < 4; r++) {
    let c = cells.map(([x, y]) => [mirror ? -x : x, y]);
    for (let k = 0; k < r; k++) c = c.map(([x, y]) => [-y, x]);
    c = norm(c); const kk = key(c); if (seen.has(kk)) continue; seen.add(kk);
    const w = Math.max(...c.map(q => q[0])) + 1, h = Math.max(...c.map(q => q[1])) + 1;
    SHAPES.push({ id: id + SHAPES.length, base: id, cells: c, w, h, n: c.length, size: SIZE[id] });
  }
}
// how often each family turns up (per orientation it is split evenly)
const FAM_W = { dot: 0.5, i2: 1, i3: 1.2, c3: 1.2, i4: 1, o2: 1.3, l4: 1.4, t4: 0.9, s4: 0.7, i5: 0.7, o3: 0.6, r23: 0.8, bigL: 0.9 };
const famCount = {}; for (const s of SHAPES) famCount[s.base] = (famCount[s.base] || 0) + 1;

// ---------------------------------------------------------------- grid
export const emptyGrid = () => Array.from({ length: N }, () => Array(N).fill(null));
export const cloneGrid = g => g.map(r => r.map(c => c && { ...c }));
export function fits(g, s, gx, gy) {
  if (gx < 0 || gy < 0 || gx + s.w > N || gy + s.h > N) return false;
  for (const [x, y] of s.cells) if (g[gy + y][gx + x]) return false;
  return true;
}
export function spots(g, s) { const out = []; for (let y = 0; y <= N - s.h; y++) for (let x = 0; x <= N - s.w; x++) if (fits(g, s, x, y)) out.push([x, y]); return out; }
export const anyFit = (g, s) => { for (let y = 0; y <= N - s.h; y++) for (let x = 0; x <= N - s.w; x++) if (fits(g, s, x, y)) return true; return false; };
/** rows + columns that would be complete after putting s at gx,gy (no mutation) */
export function wouldClear(g, s, gx, gy) {
  const filled = new Set(s.cells.map(([x, y]) => (gy + y) * N + gx + x)), on = (x, y) => !!g[y][x] || filled.has(y * N + x);
  const rows = [], cols = [];
  for (let y = 0; y < N; y++) { let ok = true; for (let x = 0; x < N && ok; x++) ok = on(x, y); if (ok) rows.push(y); }
  for (let x = 0; x < N; x++) { let ok = true; for (let y = 0; y < N && ok; y++) ok = on(x, y); if (ok) cols.push(x); }
  return { rows, cols };
}
/** put piece p ({shape, color, gem: index into cells or -1, gemType}) at gx,gy; clears lines; returns what happened */
export function place(g, p, gx, gy) {
  const s = p.shape;
  s.cells.forEach(([x, y], i) => { g[gy + y][gx + x] = { c: p.color, gem: i === p.gem ? p.gemType : -1 }; });
  const { rows, cols } = wouldClear(g, { cells: [], w: 0, h: 0 }, 0, 0);
  const cleared = [], seen = new Set();
  const take = (x, y) => { const k = y * N + x; if (seen.has(k)) return; seen.add(k); cleared.push({ x, y, ...g[y][x] }); };
  for (const y of rows) for (let x = 0; x < N; x++) take(x, y);
  for (const x of cols) for (let y = 0; y < N; y++) take(x, y);
  for (const c of cleared) g[c.y][c.x] = null;
  return { rows, cols, lines: rows.length + cols.length, cleared, empty: g.every(r => r.every(c => !c)) };
}

// ---------------------------------------------------------------- placement heuristic (hint, bot, dealer look-ahead)
function holes(g) {   // empty cells boxed in on all 4 sides (by blocks or walls): the board's "dead" space
  let h = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) {
    const b = (xx, yy) => xx < 0 || yy < 0 || xx >= N || yy >= N || !!g[yy][xx];
    if (b(x - 1, y) && b(x + 1, y) && b(x, y - 1) && b(x, y + 1)) h++;
  }
  return h;
}
function rough(g) {   // filled/empty transitions along rows and columns: lower = tidier board
  let t = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N - 1; x++) if (!!g[y][x] !== !!g[y][x + 1]) t++;
  for (let x = 0; x < N; x++) for (let y = 0; y < N - 1; y++) if (!!g[y][x] !== !!g[y + 1][x]) t++;
  return t;
}
const BIG = SHAPES.filter(s => s.base === 'o3' || (s.base === 'i5'));
export function evalPlacement(g, p, gx, gy, { gemWant = null } = {}) {
  const t = cloneGrid(g), r = place(t, p, gx, gy);
  let sc = r.lines * 60 + (r.lines > 1 ? r.lines * 25 : 0) + (r.empty ? 400 : 0);
  if (gemWant) for (const c of r.cleared) if (c.gem >= 0 && gemWant[c.gem] > 0) sc += 120;
  let filled = 0; for (const row of t) for (const c of row) if (c) filled++;
  sc -= holes(t) * 14 + rough(t) * 1.6 + filled * 0.4;
  sc += BIG.filter(s => anyFit(t, s)).length * 3;
  // tuck pieces against walls / blocks
  for (const [x, y] of p.shape.cells) { const X = gx + x, Y = gy + y; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + dx, yy = Y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N || g[yy][xx]) sc += 0.8; } }
  return { score: sc, res: r, grid: t };
}
/** best move among the tray pieces: { i, x, y, score } or null */
export function bestMove(g, tray, opts = {}) {
  let best = null;
  tray.forEach((p, i) => { if (!p) return; for (const [x, y] of spots(g, p.shape)) { const e = evalPlacement(g, p, x, y, opts); if (!best || e.score > best.score) best = { i, x, y, score: e.score }; } });
  return best;
}

// ---------------------------------------------------------------- dealer
// Same rules for everyone at a given level: `help` (0..1) is how often a slot is drawn from pieces that fit right now,
// `big` weights the large pieces. One rule always holds: at least one of the three fits the board when dealt.
export function makeDealer(rnd, { help = 0.7, big = 1, small = 1, gemRate = 0, sequential = false } = {}) {
  const wOf = s => FAM_W[s.base] / famCount[s.base] * (s.size === 'l' ? big : s.size === 's' ? small : 1);
  const pickFrom = list => { let tot = 0; for (const s of list) tot += wOf(s); let r = rnd() * tot; for (const s of list) { r -= wOf(s); if (r <= 0) return s; } return list[list.length - 1]; };
  const mk = (shape, gemNeed) => {
    const p = { shape, color: (rnd() * COLORS) | 0, gem: -1, gemType: -1 };
    if (gemNeed && gemNeed.length && rnd() < gemRate) { p.gem = (rnd() * shape.n) | 0; p.gemType = gemNeed[(rnd() * gemNeed.length) | 0]; }
    return p;
  };
  function seqOk(g, tray) {   // can the three be placed one after another (greedy best spot), in some order?
    const orders = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [0, 2, 1]];
    for (const o of orders) {
      let t = cloneGrid(g), ok = true;
      for (const i of o) { const b = bestMove(t, [tray[i]]); if (!b) { ok = false; break; } place(t, tray[i], b.x, b.y); }
      if (ok) return true;
    }
    return false;
  }
  return {
    deal(g, gemNeed = []) {
      for (let attempt = 0; attempt < (sequential ? 24 : 1); attempt++) {
        const tray = [];
        for (let k = 0; k < 3; k++) {
          let s;
          if (rnd() < help) {
            const ok = SHAPES.filter(sh => anyFit(g, sh));
            // half the helpful draws go to a piece that finishes a line somewhere
            if (ok.length && rnd() < 0.5) { const fin = ok.filter(sh => spots(g, sh).some(([x, y]) => { const w = wouldClear(g, sh, x, y); return w.rows.length + w.cols.length > 0; })); s = fin.length ? pickFrom(fin) : pickFrom(ok); }
            else s = ok.length ? pickFrom(ok) : pickFrom(SHAPES);
          } else s = pickFrom(SHAPES);
          tray.push(mk(s, gemNeed));
        }
        if (!tray.some(p => anyFit(g, p.shape))) {   // the one fixed rule: something always fits when dealt
          const ok = SHAPES.filter(sh => anyFit(g, sh));
          if (ok.length) tray[(rnd() * 3) | 0] = mk(pickFrom(ok), gemNeed);
        }
        if (!sequential || seqOk(g, tray)) return tray;
      }
      // easy levels: fall back to small pieces that surely fit in sequence
      const small = SHAPES.filter(s => s.n <= 3 && anyFit(g, s));
      return [0, 1, 2].map(() => mk(small.length ? pickFrom(small) : SHAPES[0], gemNeed));
    },
  };
}

// ---------------------------------------------------------------- levels
// Adventure level n: a starter board (some near-complete lines, some with gems inside), gem goals, a star par.
// First 5 levels are near-certain wins; then a gentle sawtooth with a short "Hard" level every 6th.
export function makeLevel(n, fk = 1, rnd, { daily = false } = {}) {
  const easy = !daily && n <= 5, hard = !daily && n > 5 && n % 6 === 0;
  const tier = Math.min(1, (n - 1) / 40);
  const types = n <= 2 ? 1 : n <= 7 ? 2 : (n % 3 === 0 ? 3 : 2);
  const pool = [...GEMS].sort(() => rnd() - 0.5).slice(0, types);
  let total = Math.round((easy ? 3 + n : 5 + tier * 7 + (n % 3)) * (hard ? 0.75 : 1) * Math.min(1.2, Math.max(0.9, fk)));
  if (daily) total = 9;
  const goals = pool.map((t, i) => ({ type: GEMS.indexOf(t), n: Math.max(2, Math.round(total / types) + (i === 0 ? total % types : 0)) }));
  // starter board
  const g = emptyGrid();
  const density = (easy ? 0.16 : hard ? 0.36 : 0.2 + tier * 0.12) * fk;
  const nearLines = easy ? 2 + (n > 2 ? 1 : 0) : hard ? 1 : 2 + (rnd() < 0.4 ? 1 : 0);
  const gemCells = [];
  const used = new Set();
  for (let k = 0; k < nearLines; k++) {   // nearly-full rows/columns holding gems: the first satisfying clears
    const horiz = rnd() < 0.5; let idx; let tries = 0;
    do { idx = (rnd() * N) | 0; tries++; } while (used.has((horiz ? 'r' : 'c') + idx) && tries < 20);
    used.add((horiz ? 'r' : 'c') + idx);
    const gaps = new Set(); const ng = easy ? 1 + ((rnd() * 2) | 0) : 2 + ((rnd() * 2) | 0);
    const start = (rnd() * (N - ng)) | 0; for (let q = 0; q < ng; q++) gaps.add(start + q);
    for (let q = 0; q < N; q++) { if (gaps.has(q)) continue; const x = horiz ? q : idx, y = horiz ? idx : q; if (!g[y][x]) { g[y][x] = { c: (rnd() * COLORS) | 0, gem: -1 }; gemCells.push([x, y]); } }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x] && rnd() < density) g[y][x] = { c: (rnd() * COLORS) | 0, gem: -1 };
  // never start with a full line
  for (let pass = 0; pass < 3; pass++) {
    const { rows, cols } = wouldClear(g, { cells: [], w: 0, h: 0 }, 0, 0);
    for (const y of rows) g[y][(rnd() * N) | 0] = null;
    for (const x of cols) g[(rnd() * N) | 0][x] = null;
  }
  // gems: ~60% of the goal starts on the board (half of them inside the near-full lines), the rest arrives on pieces
  const filled = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) filled.push([x, y]);
  const onLine = gemCells.filter(([x, y]) => g[y][x]).sort(() => rnd() - 0.5), lineKeys = new Set(onLine.map(([x, y]) => y * N + x)), other = filled.filter(([x, y]) => !lineKeys.has(y * N + x)).sort(() => rnd() - 0.5);
  for (const goal of goals) {
    const want = Math.min(goal.n, Math.ceil(goal.n * (easy ? 1 : 0.6)));
    for (let k = 0; k < want; k++) { const c = (easy || k % 2 === 0 ? onLine.shift() : other.shift()) || onLine.shift() || other.shift(); if (!c) break; g[c[1]][c[0]].gem = goal.type; }
  }
  const gemTotal = goals.reduce((a, q) => a + q.n, 0);
  const par = Math.round((easy ? 3 + gemTotal * 0.9 : 6 + gemTotal * 1.2) + (hard ? 3 : 0));
  return {
    n, easy, hard, daily, goals, grid: g, par,
    dealer: { help: easy ? 0.95 : daily ? 0.72 : hard ? Math.max(0.4, 0.66 / fk) : Math.max(0.5, (0.88 - tier * 0.2) / fk), big: easy ? 0.5 : (hard ? 1.25 : 0.9 + tier * 0.3) * fk, small: easy ? 1.4 : 1, gemRate: easy ? 0.5 : 0.35, sequential: easy },
  };
}
/** classic endless: starts empty; the dealer gets a little less generous as the score climbs */
export function classicDealerOpts(score, fk = 1) {
  const p = Math.min(1, score / 4000);
  return { help: Math.max(0.35, (0.82 - 0.4 * p) / fk), big: (0.8 + 0.5 * p) * fk, small: 1, gemRate: 0, sequential: score < 150 };
}
/** points for one placement: cells placed + lines (bigger multi-line clears pay more) × combo streak */
export function points(cells, lines, combo, empty) {
  let p = cells;
  if (lines) p += 10 * lines * (lines + 1) / 2 * Math.max(1, combo);
  if (empty) p += 300;
  return Math.round(p);
}

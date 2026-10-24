// Oak & Ivy logic: 9×9 board split into nine 3×3 squares. Place pieces; full rows, columns and squares clear.
// Pieces, the fair dealer (three at a time, at least one always fits when dealt), calm level generation, endless
// dealer settings, scoring, and a placement heuristic used by the hint and the QA bot. Pure logic, no DOM.
export const N = 9;
export const GOALS = ['rose', 'sage', 'navy'];          // painted blossom blocks the levels ask for
// cell = null | { k: 'oak' (yours) | 'walnut' (old wood already on the board) | 'rose' | 'sage' | 'navy' }

// ---------------------------------------------------------------- pieces (Woodoku-style family, all orientations)
const BASE = {
  dot: ['#'], i2: ['##'], i3: ['###'], i4: ['####'], i5: ['#####'], o2: ['##', '##'],
  c3: ['##', '#.'], l4: ['#.', '#.', '##'], t4: ['###', '.#.'], s4: ['.##', '##.'],
  plus: ['.#.', '###', '.#.'], bigL: ['#..', '#..', '###'], u5: ['#.#', '###'], t5: ['###', '.#.', '.#.'],
  d2: ['#.', '.#'], d3: ['#..', '.#.', '..#'],
};
const SIZE = { dot: 's', i2: 's', i3: 's', c3: 's', d2: 's', i4: 'm', o2: 'm', l4: 'm', t4: 'm', s4: 'm', d3: 'm', i5: 'l', plus: 'l', bigL: 'l', u5: 'l', t5: 'l' };
const FAM_W = { dot: 0.45, i2: 1, i3: 1.1, i4: 0.9, i5: 0.6, o2: 1.2, c3: 1.2, l4: 1.3, t4: 0.9, s4: 0.7, plus: 0.45, bigL: 0.75, u5: 0.6, t5: 0.5, d2: 0.5, d3: 0.35 };
const norm = cells => { const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])); return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); };
export const SHAPES = [];
for (const [id, rows] of Object.entries(BASE)) {
  const cells = []; rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && cells.push([x, y])));
  const seen = new Set();
  for (const mirror of [false, true]) for (let r = 0; r < 4; r++) {
    let c = cells.map(([x, y]) => [mirror ? -x : x, y]);
    for (let k = 0; k < r; k++) c = c.map(([x, y]) => [-y, x]);
    c = norm(c); const kk = c.map(q => q.join(',')).join(';'); if (seen.has(kk)) continue; seen.add(kk);
    SHAPES.push({ id: id + '_' + SHAPES.length, base: id, cells: c, w: Math.max(...c.map(q => q[0])) + 1, h: Math.max(...c.map(q => q[1])) + 1, n: c.length, size: SIZE[id] });
  }
}
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
/** rows, columns and 3×3 squares complete after putting shape s at gx,gy (no mutation; s may be null) */
export function wouldClear(g, s, gx, gy) {
  const filled = new Set(s ? s.cells.map(([x, y]) => (gy + y) * N + gx + x) : []), on = (x, y) => !!g[y][x] || filled.has(y * N + x);
  const rows = [], cols = [], boxes = [];
  for (let y = 0; y < N; y++) { let ok = true; for (let x = 0; x < N && ok; x++) ok = on(x, y); if (ok) rows.push(y); }
  for (let x = 0; x < N; x++) { let ok = true; for (let y = 0; y < N && ok; y++) ok = on(x, y); if (ok) cols.push(x); }
  for (let b = 0; b < 9; b++) { const bx = (b % 3) * 3, by = Math.floor(b / 3) * 3; let ok = true; for (let k = 0; k < 9 && ok; k++) ok = on(bx + k % 3, by + Math.floor(k / 3)); if (ok) boxes.push(b); }
  return { rows, cols, boxes, n: rows.length + cols.length + boxes.length };
}
export function clearCells(w) {
  const set = new Set();
  for (const y of w.rows) for (let x = 0; x < N; x++) set.add(y * N + x);
  for (const x of w.cols) for (let y = 0; y < N; y++) set.add(y * N + x);
  for (const b of w.boxes) { const bx = (b % 3) * 3, by = Math.floor(b / 3) * 3; for (let k = 0; k < 9; k++) set.add((by + Math.floor(k / 3)) * N + bx + k % 3); }
  return [...set].map(i => [i % N, Math.floor(i / N)]);
}
/** put piece p ({shape, goal: index of a painted cell or -1, gk: its kind}) at gx,gy; clears; returns what happened */
export function place(g, p, gx, gy) {
  p.shape.cells.forEach(([x, y], i) => { g[gy + y][gx + x] = { k: i === p.goal ? p.gk : 'oak' }; });
  const w = wouldClear(g, null, 0, 0), cells = clearCells(w), cleared = [];
  for (const [x, y] of cells) { cleared.push({ x, y, k: g[y][x].k }); }
  for (const c of cleared) g[c.y][c.x] = null;
  return { ...w, groups: w.n, cleared, empty: g.every(r => r.every(c => !c)) };
}

// ---------------------------------------------------------------- heuristic (hint, bot, dealer look-ahead)
function holes(g) {
  let h = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) {
    const b = (xx, yy) => xx < 0 || yy < 0 || xx >= N || yy >= N || !!g[yy][xx];
    if (b(x - 1, y) && b(x + 1, y) && b(x, y - 1) && b(x, y + 1)) h++;
  }
  return h;
}
function rough(g) {
  let t = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N - 1; x++) if (!!g[y][x] !== !!g[y][x + 1]) t++;
  for (let x = 0; x < N; x++) for (let y = 0; y < N - 1; y++) if (!!g[y][x] !== !!g[y + 1][x]) t++;
  // box borders count a little extra: Woodoku players keep squares tidy
  return t;
}
const PROBE = SHAPES.filter(s => ['o2', 'i4', 'plus', 'bigL', 'i5'].includes(s.base));
export function evalPlacement(g, p, gx, gy, { want = null } = {}) {
  const t = cloneGrid(g), r = place(t, p, gx, gy);
  let sc = r.groups * 70 + (r.groups > 1 ? r.groups * 30 : 0) + (r.empty ? 300 : 0);
  if (want) for (const c of r.cleared) if (want[c.k] > 0) sc += 110;
  let filled = 0; for (const row of t) for (const c of row) if (c) filled++;
  sc -= holes(t) * 16 + rough(t) * 1.4 + filled * 0.5;
  sc += PROBE.filter(s => anyFit(t, s)).length * 1.2;
  for (const [x, y] of p.shape.cells) { const X = gx + x, Y = gy + y; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = X + dx, yy = Y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N || g[yy][xx]) sc += 0.7; } }
  // goal blocks want to sit next to the near-complete lines that will take them away
  if (want && p.goal >= 0 && t[gy + p.shape.cells[p.goal][1]][gx + p.shape.cells[p.goal][0]]) {
    const X = gx + p.shape.cells[p.goal][0], Y = gy + p.shape.cells[p.goal][1], bx = X - X % 3, by = Y - Y % 3; let r = 0, c = 0, b = 0;
    for (let k = 0; k < N; k++) { if (t[Y][k]) r++; if (t[k][X]) c++; if (t[by + Math.floor(k / 3)][bx + k % 3]) b++; }
    sc += Math.max(r, c, b) * 2;
  }
  return { score: sc, res: r };
}
export function bestMove(g, tray, opts = {}) {
  let best = null;
  tray.forEach((p, i) => { if (!p) return; for (const [x, y] of spots(g, p.shape)) { const e = evalPlacement(g, p, x, y, opts); if (!best || e.score > best.score) best = { i, x, y, score: e.score }; } });
  return best;
}

// ---------------------------------------------------------------- dealer
// Same rules for everyone at a level: `help` (0..1) = share of draws taken from pieces that fit now, `big` weights
// large pieces. Fixed rule: at least one of the three fits when dealt. `sequential` (easy levels): all three can be
// placed one after another.
export function makeDealer(rnd, { help = 0.7, big = 1, small = 1, goalRate = 0, sequential = false } = {}) {
  const wOf = s => FAM_W[s.base] / famCount[s.base] * (s.size === 'l' ? big : s.size === 's' ? small : 1);
  const pickFrom = list => { let tot = 0; for (const s of list) tot += wOf(s); let r = rnd() * tot; for (const s of list) { r -= wOf(s); if (r <= 0) return s; } return list[list.length - 1]; };
  const mk = (shape, need) => {
    const p = { shape, goal: -1, gk: null, id: Math.random().toString(36).slice(2) };
    if (need && need.length && rnd() < goalRate) { p.goal = (rnd() * shape.n) | 0; p.gk = need[(rnd() * need.length) | 0]; }
    return p;
  };
  function seqOk(g, tray) {
    for (const o of [[0, 1, 2], [1, 0, 2], [2, 1, 0], [0, 2, 1]]) {
      const t = cloneGrid(g); let ok = true;
      for (const i of o) { const b = bestMove(t, [tray[i]]); if (!b) { ok = false; break; } place(t, tray[i], b.x, b.y); }
      if (ok) return true;
    }
    return false;
  }
  return {
    deal(g, need = []) {
      for (let attempt = 0; attempt < (sequential ? 20 : 1); attempt++) {
        const tray = [];
        for (let k = 0; k < 3; k++) {
          let s;
          if (rnd() < help) {
            const ok = SHAPES.filter(sh => anyFit(g, sh));
            if (ok.length && rnd() < 0.5) { const fin = ok.filter(sh => spots(g, sh).some(([x, y]) => wouldClear(g, sh, x, y).n > 0)); s = fin.length ? pickFrom(fin) : pickFrom(ok); }
            else s = ok.length ? pickFrom(ok) : pickFrom(SHAPES);
          } else s = pickFrom(SHAPES);
          tray.push(mk(s, need));
        }
        if (!tray.some(p => anyFit(g, p.shape))) { const ok = SHAPES.filter(sh => anyFit(g, sh)); if (ok.length) tray[(rnd() * 3) | 0] = mk(pickFrom(ok), need); }
        if (!sequential || seqOk(g, tray)) return tray;
      }
      const small = SHAPES.filter(s => s.n <= 3 && anyFit(g, s));
      return [0, 1, 2].map(() => mk(small.length ? pickFrom(small) : SHAPES[0], need));
    },
  };
}

// ---------------------------------------------------------------- calm levels
// Level n: an old board with some painted blossom blocks tucked into nearly-finished rows, columns and squares.
// Goal: clear the blossoms. First 5 levels are near-certain wins; then a gentle sawtooth with a short "Hard" level
// every 6th (fewer blossoms, a busier board). Never a wall: the dealer keeps bringing blossoms on pieces too.
export function makeLevel(n, fk = 1, rnd, { daily = false } = {}) {
  const easy = !daily && n <= 5, hard = !daily && n > 5 && n % 6 === 0;
  const tier = Math.min(1, (n - 1) / 45);
  const types = daily ? 2 : n <= 2 ? 1 : n <= 8 ? 2 : (n % 3 === 0 ? 3 : 2);
  const pool = [...GOALS].sort(() => rnd() - 0.5).slice(0, hard ? Math.min(2, types) : types);
  let total = Math.round((easy ? 3 + n : 6 + tier * 8 + (n % 3)) * (hard ? 0.7 : 1) * Math.min(1.2, Math.max(0.9, fk)));
  if (daily) total = 9;
  const goals = pool.map((k, i) => ({ k, n: Math.max(2, Math.round(total / pool.length) + (i === 0 ? total % pool.length : 0)) }));
  const g = emptyGrid();
  const density = (easy ? 0.1 : hard ? 0.38 : 0.16 + tier * 0.12) * fk;
  const near = easy ? 2 + (n > 2 ? 1 : 0) : hard ? 2 : 2 + (rnd() < 0.5 ? 1 : 0);
  const lineCells = [], used = new Set();
  for (let k = 0; k < near; k++) {
    const kind = rnd() < 0.34 ? 'box' : rnd() < 0.5 ? 'row' : 'col'; let idx, tries = 0;
    do { idx = (rnd() * 9) | 0; tries++; } while (used.has(kind + idx) && tries < 20);
    used.add(kind + idx);
    const gaps = easy ? 1 + ((rnd() * 2) | 0) : 2 + ((rnd() * 2) | 0), cells = [];
    for (let q = 0; q < 9; q++) cells.push(kind === 'row' ? [q, idx] : kind === 'col' ? [idx, q] : [(idx % 3) * 3 + q % 3, Math.floor(idx / 3) * 3 + Math.floor(q / 3)]);
    // gaps: a run in a line, a corner patch in a square
    const start = (rnd() * (9 - gaps)) | 0, gapSet = new Set(); for (let q = 0; q < gaps; q++) gapSet.add(start + q);
    cells.forEach(([x, y], q) => { if (gapSet.has(q) || g[y][x]) return; g[y][x] = { k: 'walnut' }; lineCells.push([x, y]); });
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x] && rnd() < density) g[y][x] = { k: 'walnut' };
  for (let pass = 0; pass < 4; pass++) {   // never start with something already complete
    const w = wouldClear(g, null, 0, 0); if (!w.n) break;
    for (const y of w.rows) g[y][(rnd() * N) | 0] = null;
    for (const x of w.cols) g[(rnd() * N) | 0][x] = null;
    for (const b of w.boxes) g[Math.floor(b / 3) * 3 + ((rnd() * 3) | 0)][(b % 3) * 3 + ((rnd() * 3) | 0)] = null;
  }
  const filled = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) filled.push([x, y]);
  const onLine = lineCells.filter(([x, y]) => g[y][x]).sort(() => rnd() - 0.5), lk = new Set(onLine.map(([x, y]) => y * N + x)), other = filled.filter(([x, y]) => !lk.has(y * N + x)).sort(() => rnd() - 0.5);
  for (const goal of goals) {
    const want = Math.min(goal.n, Math.ceil(goal.n * (easy ? 1 : 0.65)));
    for (let k = 0; k < want; k++) { const c = (easy || k % 2 === 0 ? onLine.shift() : other.shift()) || onLine.shift() || other.shift(); if (!c) break; g[c[1]][c[0]].k = goal.k; }
  }
  const sum = goals.reduce((a, q) => a + q.n, 0);
  const par = Math.round((easy ? 4 + sum * 0.8 : 7 + sum * 1.05) + (hard ? 3 : 0));
  return {
    n, easy, hard, daily, goals, grid: g, par,
    dealer: { help: easy ? 0.95 : daily ? 0.74 : hard ? Math.max(0.36, 0.5 / fk) : Math.max(0.5, (0.86 - tier * 0.2) / fk), big: easy ? 0.5 : (hard ? 1.4 : 0.9 + tier * 0.3) * fk, small: easy ? 1.4 : 1, goalRate: easy ? 0.5 : 0.35, sequential: easy },
  };
}
/** endless: starts empty; the dealer gets a little less generous as the score climbs */
export function endlessDealer(score, fk = 1) {
  const p = Math.min(1, score / 5000);
  return { help: Math.max(0.35, (0.84 - 0.42 * p) / fk), big: (0.8 + 0.5 * p) * fk, small: 1, goalRate: 0, sequential: score < 120 };
}
/** points: cells placed + groups cleared (more at once pays more) × streak of clearing moves */
export function points(cells, groups, streak, empty) {
  let p = cells;
  if (groups) p += 18 * groups * (groups + 1) / 2 * Math.max(1, streak);
  if (empty) p += 300;
  return Math.round(p);
}

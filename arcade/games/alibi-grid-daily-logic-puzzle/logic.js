// Alibi Grid logic — puzzle generator + solver. Our own code, MIT.
// 20 people in a 4×5 grid, each innocent (0) or criminal (1). Every clue is a true statement turned into a counting
// constraint "the number of criminals among these cells is one of these values". The generator only accepts a puzzle
// when, starting from one revealed card, pure logic can always force at least one more card — so nobody ever has to guess.
export const COLS = 4, ROWS = 5, N = 20;
export const rc = (i) => [Math.floor(i / COLS), i % COLS];
export const idx = (r, c) => r * COLS + c;
export const LETTER = ['A', 'B', 'C', 'D'];
export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export const NAMES = ['Ada', 'Bram', 'Cleo', 'Dov', 'Esme', 'Finn', 'Gia', 'Hugo', 'Ines', 'Jules', 'Kofi', 'Lark', 'Milo', 'Nell', 'Otis', 'Pia', 'Quin', 'Rafe', 'Sana', 'Tove',
  'Uma', 'Vito', 'Wes', 'Xan', 'Yara', 'Zeke', 'Abel', 'Bea', 'Cass', 'Dex', 'Elio', 'Fay', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kit', 'Lev', 'Mae', 'Noor', 'Odo', 'Pax', 'Rue', 'Sol', 'Tam', 'Una', 'Vera', 'Wim', 'Yuki', 'Zola'];
export const JOBS = [
  { j: 'baker', p: 'bakers', e: '🧑‍🍳' }, { j: 'pilot', p: 'pilots', e: '🧑‍✈️' }, { j: 'farmer', p: 'farmers', e: '🧑‍🌾' }, { j: 'painter', p: 'painters', e: '🧑‍🎨' },
  { j: 'coder', p: 'coders', e: '🧑‍💻' }, { j: 'mechanic', p: 'mechanics', e: '🧑‍🔧' }, { j: 'teacher', p: 'teachers', e: '🧑‍🏫' }, { j: 'singer', p: 'singers', e: '🧑‍🎤' },
  { j: 'doctor', p: 'doctors', e: '🧑‍⚕️' }, { j: 'firefighter', p: 'firefighters', e: '🧑‍🚒' }, { j: 'scientist', p: 'scientists', e: '🧑‍🔬' }, { j: 'judge', p: 'judges', e: '🧑‍⚖️' },
];

export function neighbours(i) {
  const [r, c] = rc(i), out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(idx(rr, cc)); }
  return out;
}
const rowCells = (r) => [0, 1, 2, 3].map(c => idx(r, c));
const colCells = (c) => [0, 1, 2, 3, 4].map(r => idx(r, c));
const EDGE = [...Array(N).keys()].filter(i => { const [r, c] = rc(i); return r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1; });
const CORNERS = [0, 3, 16, 19];

// ---------------------------------------------------------------- solver
/** is there an assignment of the unknown cells that satisfies every constraint? known: array of 0/1/-1 */
export function consistent(cons, known) {
  const a = known.slice(), order = [];
  for (let i = 0; i < N; i++) if (a[i] < 0) order.push(i);
  // most-constrained first
  const deg = new Array(N).fill(0); for (const k of cons) for (const c of k.cells) deg[c]++;
  order.sort((x, y) => deg[y] - deg[x]);
  const ok = () => {
    for (const k of cons) {
      let cr = 0, un = 0; for (const c of k.cells) { if (a[c] < 0) un++; else cr += a[c]; }
      let fine = false; for (const v of k.ok) if (v >= cr && v <= cr + un) { fine = true; break; }
      if (!fine) return false;
    }
    return true;
  };
  let nodes = 0;
  const rec = (d) => {
    if (++nodes > 200000) return true;      // budget guard (never hit in practice); "consistent" is the safe answer
    if (!ok()) return false;
    if (d === order.length) return true;
    const i = order[d];
    for (const v of [0, 1]) { a[i] = v; if (rec(d + 1)) { a[i] = -1; return true; } }
    a[i] = -1; return false;
  };
  return rec(0);
}
/** value forced for cell i (0/1), or -1 if both are still possible */
export function forced(cons, known, i) {
  if (known[i] >= 0) return known[i];
  const k = known.slice();
  k[i] = 0; const c0 = consistent(cons, k);
  k[i] = 1; const c1 = consistent(cons, k);
  return c0 && !c1 ? 0 : c1 && !c0 ? 1 : -1;
}
export function deducible(cons, known) { const out = []; for (let i = 0; i < N; i++) if (known[i] < 0) { const v = forced(cons, known, i); if (v >= 0) out.push([i, v]); } return out; }

// ---------------------------------------------------------------- clue templates
const plural = (k, one, many) => k === 1 ? one : many;
const crimWord = (k) => `${k} ${plural(k, 'criminal', 'criminals')}`;
const isAre = (k) => k === 1 ? 'is' : 'are';
function templates(P, T, owner, hard) {
  // each returns {text, cells, ok, w}; null when not applicable
  const nm = (i) => `<b>${P[i].name}</b>`, cnt = (cells) => cells.reduce((s, c) => s + T[c], 0);
  const [orow, ocol] = rc(owner), out = [];
  const add = (w, text, cells, ok) => { if (cells.length) out.push({ w, text, cells, ok }); };
  const R = Math.random;
  // pick a random other person
  const other = () => { let i; do { i = Math.floor(R() * N); } while (i === owner); return i; };
  { const i = other(); add(hard ? 0.2 : 0.6, `${nm(i)} is ${T[i] ? 'a <i class="c">criminal</i>' : '<i class="n">innocent</i>'}.`, [i], [T[i]]); }
  { const r = Math.floor(R() * ROWS), k = cnt(rowCells(r)); add(1.2, `There ${isAre(k)} exactly ${crimWord(k)} in row ${r + 1}.`, rowCells(r), [k]); }
  { const c = Math.floor(R() * COLS), k = cnt(colCells(c)); add(1.2, `Column ${LETTER[c]} has exactly ${crimWord(k)}.`, colCells(c), [k]); }
  { const k = cnt(rowCells(orow)); add(1, `There ${isAre(k)} exactly ${crimWord(k)} in my row.`, rowCells(orow), [k]); }
  { const nb = neighbours(owner), k = cnt(nb); add(1.4, k === 0 ? 'All of my neighbours are <i class="n">innocent</i>.' : k === nb.length ? 'All of my neighbours are <i class="c">criminals</i>.' : `I have exactly ${k} criminal ${plural(k, 'neighbour', 'neighbours')}.`, nb, [k]); }
  { const i = other(), nb = neighbours(i), k = cnt(nb), inn = nb.length - k;
    if (R() < 0.5) add(1.4, `${nm(i)} has exactly ${k} criminal ${plural(k, 'neighbour', 'neighbours')}.`, nb, [k]);
    else add(1.2, `Exactly ${inn} of ${nm(i)}'s neighbours ${inn === 1 ? 'is' : 'are'} <i class="n">innocent</i>.`, nb, [k]); }
  { const jobs = [...new Set(P.map(p => p.job))], j = jobs[Math.floor(R() * jobs.length)], cells = P.map((p, i) => p.job === j ? i : -1).filter(i => i >= 0), k = cnt(cells), J = P[cells[0]].jobInfo;
    if (cells.length >= 2) add(hard ? 1.5 : 0.8, k === 0 ? `All ${J.p} are <i class="n">innocent</i>.` : k === cells.length ? `Every one of the ${J.p} is a <i class="c">criminal</i>.` : `Exactly ${k} of the ${cells.length} ${J.p} ${isAre(k)} ${plural(k, 'a criminal', 'criminals')}.`, cells, [k]); }
  { const a = other(); let b; do { b = other(); } while (b === a);
    if (T[a] === T[b]) add(hard ? 1.2 : 0.6, `${nm(a)} and ${nm(b)} are either both innocent or both criminals.`, [a, b], [0, 2]);
    else add(hard ? 1.2 : 0.6, `Exactly one of ${nm(a)} and ${nm(b)} is a criminal.`, [a, b], [1]); }
  { const isRow = R() < 0.5, n = isRow ? Math.floor(R() * ROWS) : Math.floor(R() * COLS), cells = isRow ? rowCells(n) : colCells(n), k = cnt(cells), odd = k % 2;
    add(hard ? 1.4 : 0.3, `There's an ${odd ? 'odd' : 'even'} number of criminals in ${isRow ? 'row ' + (n + 1) : 'column ' + LETTER[n]}.`, cells, [0, 1, 2, 3, 4, 5].filter(v => v % 2 === odd && v <= cells.length)); }
  { const isRow = R() < 0.5, n = isRow ? Math.floor(R() * ROWS) : Math.floor(R() * COLS), cells = isRow ? rowCells(n) : colCells(n), k = cnt(cells), L = cells.length, where = isRow ? 'row ' + (n + 1) : 'column ' + LETTER[n];
    if (k * 2 > L) add(hard ? 1.3 : 0.4, `${where[0].toUpperCase() + where.slice(1)} has more criminals than innocents.`, cells, [...Array(L + 1).keys()].filter(v => v * 2 > L));
    else if (k * 2 < L) add(hard ? 1.3 : 0.4, `${where[0].toUpperCase() + where.slice(1)} has more innocents than criminals.`, cells, [...Array(L + 1).keys()].filter(v => v * 2 < L));
    else add(hard ? 1 : 0.4, `${where[0].toUpperCase() + where.slice(1)} is split evenly between innocents and criminals.`, cells, [L / 2]); }
  { const i = R() < 0.5 ? owner : other(), [r, c] = rc(i), up = R() < 0.5, cells = up ? [...Array(r).keys()].map(rr => idx(rr, c)) : [...Array(ROWS - 1 - r).keys()].map(k => idx(r + 1 + k, c)), k = cnt(cells), me = i === owner;
    if (cells.length >= 2) add(hard ? 1.2 : 0.7, `There ${isAre(k)} exactly ${crimWord(k)} ${up ? 'above' : 'below'} ${me ? 'me' : nm(i)}.`, cells, [k]); }
  { const i = R() < 0.5 ? owner : other(), [r, c] = rc(i), left = R() < 0.5, cells = left ? [...Array(c).keys()].map(cc => idx(r, cc)) : [...Array(COLS - 1 - c).keys()].map(k => idx(r, c + 1 + k)), k = cnt(cells), me = i === owner;
    if (cells.length >= 2) add(hard ? 1 : 0.6, `There ${isAre(k)} exactly ${crimWord(k)} to the ${left ? 'left' : 'right'} of ${me ? 'me' : nm(i)}.`, cells, [k]); }
  { const k = cnt(CORNERS); add(hard ? 0.9 : 0.5, `Exactly ${k} of the four corners ${isAre(k)} ${plural(k, 'a criminal', 'criminals')}.`, CORNERS, [k]); }
  { const k = cnt(EDGE); add(hard ? 0.8 : 0.2, `There are exactly ${crimWord(k)} on the edges of the grid.`, EDGE, [k]); }
  { const c = Math.floor(R() * COLS), cells = colCells(c), k = cnt(cells); if (k >= 2) add(hard ? 1 : 0.4, `Column ${LETTER[c]} has at least ${k} criminals.`, cells, [...Array(6).keys()].filter(v => v >= k && v <= 5)); }
  return out;
}
function pickClue(P, T, owner, known, hard, rnd, used = null) {
  let all = templates(P, T, owner, hard);
  if (used) { const fresh = all.filter(c => !used.some(u => u && u.text === c.text)); if (fresh.length) all = fresh; }
  // favour clues that still talk about unknown people
  const scored = all.map(c => ({ c, w: c.w * (c.cells.some(i => known[i] < 0) ? 1 : 0.08) }));
  const tot = scored.reduce((s, x) => s + x.w, 0); let r = rnd() * tot;
  for (const x of scored) { r -= x.w; if (r <= 0) return x.c; }
  return scored[scored.length - 1].c;
}

// ---------------------------------------------------------------- generator
/** returns { people:[{name,job,jobInfo}], truth:[0/1], start, clues:[{text,cells,ok}] } */
export function generate(seed, diff = 0.3) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rngf(seed * 977 + attempt * 7919 + 11);
    const saved = Math.random; Math.random = r;          // templates use Math.random → make them seeded
    try {
      const names = NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
      const picked = names.slice(0, N).sort();
      const jobs = JOBS.slice(); for (let i = jobs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }
      const nj = 5 + Math.floor(r() * 2), use = jobs.slice(0, nj), jl = [];
      for (let i = 0; i < N; i++) jl.push(use[i % nj]);
      for (let i = jl.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [jl[i], jl[j]] = [jl[j], jl[i]]; }
      const P = picked.map((name, i) => ({ name, job: jl[i].j, jobInfo: jl[i] }));
      const nCrim = 7 + Math.floor(r() * 4), T = new Array(N).fill(0), perm = [...Array(N).keys()];
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      for (let k = 0; k < nCrim; k++) T[perm[k]] = 1;
      const hard = r() < diff;
      const start = perm[N - 1 - Math.floor(r() * (N - nCrim))];   // the first revealed card is always innocent
      const known = new Array(N).fill(-1); known[start] = T[start];
      const clues = new Array(N).fill(null);
      clues[start] = pickClue(P, T, start, known, hard, r);
      let batch = [start], ok = true, steps = 0;
      while (known.some(v => v < 0)) {
        const cons = clues.filter(Boolean);
        let ded = deducible(cons, known);
        let tries = 0;
        while (!ded.length && tries < 40) {     // re-roll a clue from the newest batch (no deduction depends on it yet)
          const c = batch[Math.floor(r() * batch.length)];
          clues[c] = pickClue(P, T, c, known, r() < diff, r, clues); tries++;
          ded = deducible(clues.filter(Boolean), known);
        }
        if (!ded.length) { ok = false; break; }
        batch = [];
        for (const [i, v] of ded) { if (v !== T[i]) { ok = false; break; } known[i] = v; batch.push(i); clues[i] = pickClue(P, T, i, known, r() < diff, r, clues); }
        if (!ok) break;
        steps++;
      }
      if (!ok) continue;
      // fewer, bigger leaps make for a dull puzzle: harder settings ask for more chained steps
      if (steps < 4 + Math.round(diff * 4) && attempt < 40) continue;
      return { people: P, truth: T, start, clues, steps };
    } finally { Math.random = saved; }
  }
  return null;
}

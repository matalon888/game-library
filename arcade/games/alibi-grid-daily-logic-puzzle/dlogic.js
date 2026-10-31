// Alibi Grid v2 logic — grids of any size, clue families, and the Grand Hotel rule (a criminal's statement is false).
// Pure module (no DOM): the game, the level baker (qa/bake.mjs) and the QA runs all import it. Our own code, MIT.
export const LETTER = 'ABCDEF';
export const NAMES = ['Ada', 'Bram', 'Cleo', 'Dov', 'Esme', 'Finn', 'Gia', 'Hugo', 'Ines', 'Jules', 'Kofi', 'Lark', 'Milo', 'Nell', 'Otis', 'Pia', 'Quin', 'Rafe', 'Sana', 'Tove',
  'Uma', 'Vito', 'Wes', 'Xan', 'Yara', 'Zeke', 'Abel', 'Bea', 'Cass', 'Dex', 'Elio', 'Fay', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kit', 'Lev', 'Mae', 'Noor', 'Odo', 'Pax', 'Rue', 'Sol', 'Tam', 'Una', 'Vera', 'Wim', 'Yuki', 'Zola'];
export const JOBS = [
  { j: 'baker', p: 'bakers', e: '🧑‍🍳' }, { j: 'pilot', p: 'pilots', e: '🧑‍✈️' }, { j: 'farmer', p: 'farmers', e: '🧑‍🌾' }, { j: 'painter', p: 'painters', e: '🧑‍🎨' },
  { j: 'coder', p: 'coders', e: '🧑‍💻' }, { j: 'mechanic', p: 'mechanics', e: '🧑‍🔧' }, { j: 'teacher', p: 'teachers', e: '🧑‍🏫' }, { j: 'singer', p: 'singers', e: '🧑‍🎤' },
  { j: 'doctor', p: 'doctors', e: '🧑‍⚕️' }, { j: 'firefighter', p: 'firefighters', e: '🧑‍🚒' }, { j: 'scientist', p: 'scientists', e: '🧑‍🔬' }, { j: 'judge', p: 'judges', e: '🧑‍⚖️' },
];
export const FAMILIES = ['direct', 'row', 'col', 'myrow', 'nbr', 'nbrOther', 'job', 'pair', 'parity', 'major', 'dir', 'corners', 'edges', 'atleast'];
export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function dims(cols, rows) {
  const N = cols * rows, rc = (i) => [Math.floor(i / cols), i % cols], idx = (r, c) => r * cols + c;
  const rowCells = (r) => Array.from({ length: cols }, (_, c) => idx(r, c)), colCells = (c) => Array.from({ length: rows }, (_, r) => idx(r, c));
  const neighbours = (i) => { const [r, c] = rc(i), out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(idx(rr, cc)); } return out; };
  const EDGE = [...Array(N).keys()].filter(i => { const [r, c] = rc(i); return r === 0 || c === 0 || r === rows - 1 || c === cols - 1; });
  const CORNERS = [...new Set([0, cols - 1, N - cols, N - 1])];
  return { cols, rows, N, rc, idx, rowCells, colCells, neighbours, EDGE, CORNERS };
}

// ---------------------------------------------------------------- solver. A constraint is {cells, ok:[counts]} on the number of criminals.
/** the constraint a revealed person's statement gives: a criminal's statement is false when `lie` is on */
export const effective = (cl, ownerVal, lie) => {
  if (!lie || !ownerVal) return { cells: cl.cells, ok: cl.ok };
  const ok = []; for (let v = 0; v <= cl.cells.length; v++) if (!cl.ok.includes(v)) ok.push(v);
  return { cells: cl.cells, ok };
};
export function consFor(clues, known, lie) { const out = []; for (let i = 0; i < known.length; i++) if (known[i] >= 0 && clues[i]) out.push(effective(clues[i], known[i], lie)); return out; }
export function consistent(cons, known) {
  const N = known.length, a = known.slice(), order = [];
  for (let i = 0; i < N; i++) if (a[i] < 0) order.push(i);
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
    if (++nodes > 200000) return true;
    if (!ok()) return false;
    if (d === order.length) return true;
    const i = order[d];
    for (const v of [0, 1]) { a[i] = v; if (rec(d + 1)) { a[i] = -1; return true; } }
    a[i] = -1; return false;
  };
  return rec(0);
}
export function forced(cons, known, i) {
  if (known[i] >= 0) return known[i];
  const k = known.slice();
  k[i] = 0; const c0 = consistent(cons, k);
  k[i] = 1; const c1 = consistent(cons, k);
  return c0 && !c1 ? 0 : c1 && !c0 ? 1 : -1;
}
export function deducible(cons, known) { const out = []; for (let i = 0; i < known.length; i++) if (known[i] < 0) { const v = forced(cons, known, i); if (v >= 0) out.push([i, v]); } return out; }

// ---------------------------------------------------------------- statements. lie=true builds a FALSE statement (a criminal's, in the Grand Hotel).
const plural = (k, one, many) => k === 1 ? one : many;
const crimWord = (k) => `${k} ${plural(k, 'criminal', 'criminals')}`;
const isAre = (k) => k === 1 ? 'is' : 'are';
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** the weights below are per family; `focus` families get x4 so a level that teaches one really uses it */
const W = { direct: 0.7, row: 1.2, col: 1.2, myrow: 1, nbr: 1.4, nbrOther: 1.4, job: 1, pair: 0.9, parity: 0.8, major: 0.8, dir: 0.9, corners: 0.5, edges: 0.4, atleast: 0.5 };
export function statements(G, P, T, owner, lie, fams, focus, r) {
  const { rows, cols, N, rc, idx, rowCells, colCells, neighbours, EDGE, CORNERS } = G;
  const nm = (i) => `<b>${P[i].name}</b>`, cnt = (cells) => cells.reduce((s, c) => s + T[c], 0);
  const [orow] = rc(owner), out = [];
  const add = (fam, text, cells, ok) => { if (fams.includes(fam) && cells.length) out.push({ fam, w: W[fam] * (focus.includes(fam) ? 4 : 1), text, cells, ok }); };
  const other = () => { let i; do { i = Math.floor(r() * N); } while (i === owner); return i; };
  // a claimed count: the truth, or (lie) a near miss that is wrong
  const claim = (k, len) => { if (!lie) return k; const c = []; for (let v = Math.max(0, k - 2); v <= Math.min(len, k + 2); v++) if (v !== k) c.push(v); return c[Math.floor(r() * c.length)]; };
  { const i = other(), v = lie ? 1 - T[i] : T[i]; add('direct', `${nm(i)} is ${v ? 'a <i class="c">criminal</i>' : '<i class="n">innocent</i>'}.`, [i], [v]); }
  { const n = Math.floor(r() * rows), cells = rowCells(n), c = claim(cnt(cells), cells.length); add('row', `There ${isAre(c)} exactly ${crimWord(c)} in row ${n + 1}.`, cells, [c]); }
  { const n = Math.floor(r() * cols), cells = colCells(n), c = claim(cnt(cells), cells.length); add('col', `Column ${LETTER[n]} has exactly ${crimWord(c)}.`, cells, [c]); }
  { const cells = rowCells(orow), c = claim(cnt(cells), cells.length); add('myrow', `There ${isAre(c)} exactly ${crimWord(c)} in my row.`, cells, [c]); }
  { const nb = neighbours(owner), c = claim(cnt(nb), nb.length); add('nbr', c === 0 ? 'All of my neighbours are <i class="n">innocent</i>.' : c === nb.length ? 'All of my neighbours are <i class="c">criminals</i>.' : `I have exactly ${c} criminal ${plural(c, 'neighbour', 'neighbours')}.`, nb, [c]); }
  { const i = other(), nb = neighbours(i), c = claim(cnt(nb), nb.length), inn = nb.length - c;
    if (r() < 0.5) add('nbrOther', `${nm(i)} has exactly ${c} criminal ${plural(c, 'neighbour', 'neighbours')}.`, nb, [c]);
    else add('nbrOther', `Exactly ${inn} of ${nm(i)}'s neighbours ${inn === 1 ? 'is' : 'are'} <i class="n">innocent</i>.`, nb, [c]); }
  { const jobs = [...new Set(P.map(p => p.job))], j = jobs[Math.floor(r() * jobs.length)], cells = P.map((p, i) => p.job === j ? i : -1).filter(i => i >= 0), J = P[cells[0]].jobInfo;
    if (cells.length >= 2) { const c = claim(cnt(cells), cells.length); add('job', c === 0 ? `All ${J.p} are <i class="n">innocent</i>.` : c === cells.length ? `Every one of the ${J.p} is a <i class="c">criminal</i>.` : `Exactly ${c} of the ${cells.length} ${J.p} ${isAre(c)} ${plural(c, 'a criminal', 'criminals')}.`, cells, [c]); } }
  { const a = other(); let b; do { b = other(); } while (b === a);
    const same = (T[a] === T[b]) !== lie;
    add('pair', same ? `${nm(a)} and ${nm(b)} are either both innocent or both criminals.` : `Exactly one of ${nm(a)} and ${nm(b)} is a criminal.`, [a, b], same ? [0, 2] : [1]); }
  { const isRow = r() < 0.5, n = isRow ? Math.floor(r() * rows) : Math.floor(r() * cols), cells = isRow ? rowCells(n) : colCells(n), odd = (cnt(cells) % 2) ^ (lie ? 1 : 0);
    add('parity', `There's an ${odd ? 'odd' : 'even'} number of criminals in ${isRow ? 'row ' + (n + 1) : 'column ' + LETTER[n]}.`, cells, [...Array(cells.length + 1).keys()].filter(v => v % 2 === odd)); }
  { const isRow = r() < 0.5, n = isRow ? Math.floor(r() * rows) : Math.floor(r() * cols), cells = isRow ? rowCells(n) : colCells(n), k = cnt(cells), L = cells.length, where = cap(isRow ? 'row ' + (n + 1) : 'column ' + LETTER[n]);
    const real = k * 2 > L ? 'more' : k * 2 < L ? 'less' : 'even', kinds = L % 2 ? ['more', 'less'] : ['more', 'less', 'even'];
    const say = lie ? kinds.filter(x => x !== real)[Math.floor(r() * (kinds.length - 1))] : real, vals = [...Array(L + 1).keys()];
    if (say === 'more') add('major', `${where} has more criminals than innocents.`, cells, vals.filter(v => v * 2 > L));
    else if (say === 'less') add('major', `${where} has more innocents than criminals.`, cells, vals.filter(v => v * 2 < L));
    else add('major', `${where} is split evenly between innocents and criminals.`, cells, [L / 2]); }
  { const i = r() < 0.5 ? owner : other(), [rr, cc] = rc(i), me = i === owner, dir = ['above', 'below', 'left', 'right'][Math.floor(r() * 4)];
    const cells = dir === 'above' ? [...Array(rr).keys()].map(q => idx(q, cc)) : dir === 'below' ? [...Array(rows - 1 - rr).keys()].map(q => idx(rr + 1 + q, cc)) : dir === 'left' ? [...Array(cc).keys()].map(q => idx(rr, q)) : [...Array(cols - 1 - cc).keys()].map(q => idx(rr, cc + 1 + q));
    if (cells.length >= 2) { const c = claim(cnt(cells), cells.length); add('dir', `There ${isAre(c)} exactly ${crimWord(c)} ${dir === 'above' || dir === 'below' ? dir : 'to the ' + dir + ' of'} ${dir === 'above' || dir === 'below' ? '' : ''}${me ? 'me' : nm(i)}.`.replace(/(above|below) (me|<b>)/, '$1 $2'), cells, [c]); } }
  { const c = claim(cnt(CORNERS), CORNERS.length); add('corners', `Exactly ${c} of the four corners ${isAre(c)} ${plural(c, 'a criminal', 'criminals')}.`, CORNERS, [c]); }
  { const c = claim(cnt(EDGE), EDGE.length); add('edges', `There are exactly ${crimWord(c)} on the edges of the grid.`, EDGE, [c]); }
  { const n = Math.floor(r() * cols), cells = colCells(n), k = cnt(cells);
    if (!lie && k >= 2) add('atleast', `Column ${LETTER[n]} has at least ${k} criminals.`, cells, Array.from({ length: cells.length - k + 1 }, (_, q) => k + q));
    if (lie && k + 1 <= cells.length) { const m = k + 1 + Math.floor(r() * (cells.length - k)); if (m >= 2) add('atleast', `Column ${LETTER[n]} has at least ${m} criminals.`, cells, Array.from({ length: cells.length - m + 1 }, (_, q) => m + q)); } }
  return out;
}
function pick(all, known, used, r) {
  let a = all; if (used) { const fresh = a.filter(c => !used.some(u => u && u.text === c.text)); if (fresh.length) a = fresh; }
  const scored = a.map(c => ({ c, w: c.w * (c.cells.some(i => known[i] < 0) ? 1 : 0.08) }));
  const tot = scored.reduce((s, x) => s + x.w, 0); let q = r() * tot;
  for (const x of scored) { q -= x.w; if (q <= 0) return x.c; }
  return scored[scored.length - 1].c;
}

/** Build one case.
 *  spec: { cols, rows, truth?: string with 'x' = criminal, '.' = innocent (row by row), start?: index of an innocent to open with,
 *          fams: [...], focus: [...], lie: bool, minSteps, maxJobs }.
 *  Returns { people, truth, start, clues:[{text,cells,ok,fam}], steps, lie } or null. The first card is always an innocent. */
export function generate(seed, spec) {
  const G = dims(spec.cols, spec.rows), { N } = G, lie = !!spec.lie, fams = spec.fams, focus = spec.focus || [];
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = rngf(seed * 977 + attempt * 7919 + 11);
    const names = NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const picked = names.slice(0, N).sort();
    const jobs = JOBS.slice(); for (let i = jobs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [jobs[i], jobs[j]] = [jobs[j], jobs[i]]; }
    const nj = Math.max(3, Math.min(6, Math.round(N / 3.5))), use = jobs.slice(0, nj), jl = [];
    for (let i = 0; i < N; i++) jl.push(use[i % nj]);
    for (let i = jl.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [jl[i], jl[j]] = [jl[j], jl[i]]; }
    const P = picked.map((name, i) => ({ name, job: jl[i].j, jobInfo: jl[i] }));
    let T;
    if (spec.truth) T = [...spec.truth.replace(/\s/g, '')].map(ch => ch === 'x' ? 1 : 0);
    else { const nCrim = Math.round(N * (0.35 + r() * 0.15)); T = new Array(N).fill(0); const perm = [...Array(N).keys()]; for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } for (let k = 0; k < nCrim; k++) T[perm[k]] = 1; }
    const inn = T.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    const start = spec.start != null ? spec.start : inn[Math.floor(r() * inn.length)];
    const known = new Array(N).fill(-1); known[start] = T[start];
    const clues = new Array(N).fill(null);
    const mk = (i) => { const all = statements(G, P, T, i, lie && T[i] === 1, fams, focus, r); return all.length ? pick(all, known, clues, r) : null; };
    clues[start] = mk(start); if (!clues[start]) continue;
    let batch = [start], ok = true, steps = 0, spoken = 1;
    while (known.some(v => v < 0)) {
      let ded = deducible(consFor(clues, known, lie), known), tries = 0;
      while (!ded.length && tries < 40) {
        const c = batch[Math.floor(r() * batch.length)];
        const nc = mk(c); if (nc) clues[c] = nc; tries++;
        ded = deducible(consFor(clues, known, lie), known);
      }
      if (!ded.length) { ok = false; break; }
      batch = [];
      for (const [i, v] of ded) { if (v !== T[i]) { ok = false; break; } known[i] = v; batch.push(i); clues[i] = mk(i); if (!clues[i]) { ok = false; break; } }
      if (!ok) break;
      steps++;
    }
    if (!ok) continue;
    if (steps < (spec.minSteps || 2)) continue;
    if (spec.maxSteps && steps > spec.maxSteps) continue;
    return { people: P.map(p => ({ name: p.name, job: p.job, e: p.jobInfo.e })), truth: T, start, clues: clues.map(c => c && { text: c.text, cells: c.cells, ok: c.ok, fam: c.fam }), steps, lie };
  }
  return null;
}

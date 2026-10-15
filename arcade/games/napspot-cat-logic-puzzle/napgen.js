// napgen.js — Napspot puzzle generator + human-style logic solver (pure, no DOM). Our own code, MIT.
// Board: N×N cells split into N colour regions. Solution: one cat per row, column and region, no two cats touching.
// A puzzle is accepted only if the logic solver below finishes it without guessing, which also proves the solution is unique.
export const UNK = 0, NO = 1, CAT = 2;

// one cat per row; column per row, never touching the cat above (diagonal included)
function perm(N, r) {
  const p = [], used = new Array(N).fill(false);
  const go = (i) => {
    if (i === N) return true;
    const cs = [...Array(N).keys()].sort(() => r() - 0.5);
    for (const c of cs) { if (used[c] || (i && Math.abs(p[i - 1] - c) < 2)) continue; used[c] = true; p[i] = c; if (go(i + 1)) return true; used[c] = false; }
    return false;
  };
  return go(0) ? p : null;
}
// grow N regions from the cats with a random, slightly lumpy flood fill
function grow(N, p, r) {
  const reg = new Array(N * N).fill(-1), size = new Array(N).fill(1), want = [];
  for (let i = 0; i < N; i++) { reg[i * N + p[i]] = i; want.push(0.4 + r() * 1.6); }
  let left = N * N - N;
  while (left > 0) {
    // pick a region (bias by its appetite, smaller regions a little hungrier), then one of its free neighbours
    let tot = 0; const w = want.map((a, i) => { const v = a / Math.sqrt(size[i]); tot += v; return v; });
    let x = r() * tot, k = 0; while (k < N - 1 && x > w[k]) { x -= w[k]; k++; }
    const fr = [];
    for (let c = 0; c < N * N; c++) if (reg[c] === k) {
      const y = (c / N) | 0, xx = c % N;
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ny = y + dy, nx = xx + dx; if (ny >= 0 && ny < N && nx >= 0 && nx < N && reg[ny * N + nx] < 0) fr.push(ny * N + nx); }
    }
    if (!fr.length) { want[k] *= 0.5; if (want.every(a => a < 1e-6)) break; continue; }
    const c = fr[Math.floor(r() * fr.length)]; reg[c] = k; size[k]++; left--;
  }
  return reg;
}

// ---------------------------------------------------------------- logic solver
// groups: rows, cols, regions (each a list of cells). Returns one deduction {c, v, rule, lvl} or null.
export function groupsOf(N, reg) {
  const rows = [], cols = [], regs = [];
  for (let i = 0; i < N; i++) { rows.push([]); cols.push([]); regs.push([]); }
  for (let c = 0; c < N * N; c++) { rows[(c / N) | 0].push(c); cols[c % N].push(c); regs[reg[c]].push(c); }
  return { rows, cols, regs, all: [...rows, ...cols, ...regs] };
}
export function blocks(N, reg, c) {   // cells a cat on c rules out
  const y = (c / N) | 0, x = c % N, out = [];
  for (let d = 0; d < N * N; d++) {
    if (d === c) continue; const yy = (d / N) | 0, xx = d % N;
    if (yy === y || xx === x || reg[d] === reg[c] || (Math.abs(yy - y) <= 1 && Math.abs(xx - x) <= 1)) out.push(d);
  }
  return out;
}
export function step(N, reg, st, G, BL, maxLvl = 3) {
  // 0: a cat rules out its row, column, region and the 8 cells around it
  for (let c = 0; c < N * N; c++) if (st[c] === CAT) for (const d of BL[c]) if (st[d] === UNK) return { c: d, v: NO, lvl: 0, rule: 'blocked' };
  // 1: a row / column / region with one free cell left
  for (const grp of G.all) {
    if (grp.some(c => st[c] === CAT)) continue;
    const free = grp.filter(c => st[c] === UNK);
    if (free.length === 1) return { c: free[0], v: CAT, lvl: 1, rule: 'last' };
  }
  if (maxLvl < 2) return null;
  // 2: k regions squeezed into k rows (or columns) own those rows; and k rows squeezed into k regions own those regions
  const open = (grp) => !grp.some(c => st[c] === CAT);
  const lines = [[G.regs, G.rows, (c) => (c / N) | 0], [G.regs, G.cols, (c) => c % N], [G.rows, G.regs, (c) => reg[c]], [G.cols, G.regs, (c) => reg[c]]];
  for (let k = 1; k <= Math.min(3, N - 2); k++) {
    for (const [A, B, idx] of lines) {
      const cand = A.map((grp, i) => i).filter(i => open(A[i]));
      const combos = (start, pick, acc) => {
        if (acc.length === pick) {
          const cover = new Set();
          for (const i of acc) for (const c of A[i]) if (st[c] === UNK) cover.add(idx(c));
          if (cover.size !== pick) return null;
          const inA = new Set(); for (const i of acc) for (const c of A[i]) inA.add(c);
          for (const b of cover) for (const c of B[b]) if (st[c] === UNK && !inA.has(c)) return { c, v: NO, lvl: 2, rule: 'squeeze' };
          return null;
        }
        for (let s = start; s < cand.length; s++) { acc.push(cand[s]); const r = combos(s + 1, pick, acc); acc.pop(); if (r) return r; }
        return null;
      };
      const r = combos(0, k, []); if (r) return r;
    }
  }
  if (maxLvl < 3) return null;
  // 3: a cat here would leave some row / column / region with nowhere to go
  for (let c = 0; c < N * N; c++) {
    if (st[c] !== UNK) continue;
    const bl = new Set(BL[c]); bl.add(c);
    for (const grp of G.all) {
      if (grp.includes(c) || !open(grp)) continue;
      if (grp.every(d => st[d] !== UNK || bl.has(d))) return { c, v: NO, lvl: 3, rule: 'peek' };
    }
  }
  if (maxLvl < 4) return null;
  // 4: a cat here starts a short chain (blocked cells + last free cells) that empties some row / column / region
  for (let c = 0; c < N * N; c++) {
    if (st[c] !== UNK) continue;
    const t = st.slice(); t[c] = CAT;
    let bad = false;
    for (let guard = 0; guard < N * N && !bad; guard++) {
      let moved = false;
      for (let a = 0; a < N * N; a++) if (t[a] === CAT) for (const d of BL[a]) { if (t[d] === CAT) bad = true; else if (t[d] === UNK) { t[d] = NO; moved = true; } }
      for (const grp of G.all) { if (grp.some(x => t[x] === CAT)) continue; const free = grp.filter(x => t[x] === UNK); if (!free.length) bad = true; else if (free.length === 1) { t[free[0]] = CAT; moved = true; } }
      if (!moved) break;
    }
    if (bad) return { c, v: NO, lvl: 4, rule: 'chain' };
  }
  return null;
}
export function solve(N, reg, st0, maxLvl = 4) {
  const st = st0.slice(), G = groupsOf(N, reg), BL = []; for (let c = 0; c < N * N; c++) BL.push(blocks(N, reg, c));
  let hard = 0, steps = 0;
  for (;;) {
    const s = step(N, reg, st, G, BL, maxLvl); if (!s) break;
    st[s.c] = s.v; hard = Math.max(hard, s.lvl); steps++;
  }
  const cats = st.filter(v => v === CAT).length;
  return { ok: cats === N && st.every(v => v !== UNK), st, hard, steps };
}

// size and solver depth from level (fk = honest flow multiplier)
export function spec(level, fk = 1) {
  const L = level * fk;
  const N = L < 3 ? 5 : L < 7 ? 6 : L < 13 ? 7 : L < 21 ? 8 : 9;
  const maxLvl = L < 2.5 ? 1 : L < 5 ? 2 : L < 12 ? 3 : 4;
  return { N, maxLvl };
}
// every solution (up to `cap`) by plain backtracking — used only to steer the generator, never shown to the player
function solutions(N, reg, cap = 2) {
  const out = [], q = [], usedC = new Array(N).fill(false), usedR = new Array(N).fill(false);
  const go = (i) => {
    if (out.length >= cap) return;
    if (i === N) { out.push(q.slice()); return; }
    for (let c = 0; c < N; c++) {
      const rg = reg[i * N + c];
      if (usedC[c] || usedR[rg] || (i && Math.abs(q[i - 1] - c) < 2)) continue;
      usedC[c] = usedR[rg] = true; q[i] = c; go(i + 1); usedC[c] = usedR[rg] = false;
    }
  };
  go(0); return out;
}
function connectedWithout(N, reg, k, skip) {
  const cells = []; for (let c = 0; c < N * N; c++) if (reg[c] === k && c !== skip) cells.push(c);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), st = [cells[0]];
  while (st.length) { const c = st.pop(), y = (c / N) | 0, x = c % N;
    for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ny = y + dy, nx = x + dx, d = ny * N + nx; if (ny >= 0 && ny < N && nx >= 0 && nx < N && d !== skip && reg[d] === k && !seen.has(d)) { seen.add(d); st.push(d); } } }
  return seen.size === cells.length;
}
// nudge region borders until the cats have exactly one home each
function makeUnique(N, p, reg, r) {
  const mine = new Set(p.map((c, i) => i * N + c));
  for (let it = 0; it < 80; it++) {
    const sols = solutions(N, reg, 2), alt = sols.find(q => q.some((c, i) => c !== p[i]));
    if (!alt) return true;
    const altCells = alt.map((c, i) => i * N + c), opts = [];
    for (const a of altCells) {
      if (mine.has(a)) continue;
      const y = (a / N) | 0, x = a % N;
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = y + dy, nx = x + dx; if (ny < 0 || ny >= N || nx < 0 || nx >= N) continue;
        const k = reg[ny * N + nx]; if (k === reg[a]) continue;
        const kills = altCells.some(b => b !== a && reg[b] === k);
        opts.push({ a, k, w: kills ? 4 : 1 });
      }
    }
    shuffle(opts, r); opts.sort((u, v) => v.w - u.w);
    const pick = opts.find(o => connectedWithout(N, reg, reg[o.a], o.a));
    if (!pick) return false;
    reg[pick.a] = pick.k;
  }
  return false;
}
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function generate(level, seed, fk, rngf) {
  const { N, maxLvl } = spec(level, fk), r = rngf(seed);
  let fallback = null;
  for (let t = 0; t < 400; t++) {
    const p = perm(N, r); if (!p) continue;
    const reg = grow(N, p, r); if (reg.includes(-1)) continue;
    if (!makeUnique(N, p, reg, r)) continue;
    const res = solve(N, reg, new Array(N * N).fill(UNK), maxLvl);
    if (!res.ok) { if (!fallback && maxLvl < 4) { const r4 = solve(N, reg, new Array(N * N).fill(UNK), 4); if (r4.ok) fallback = { N, reg, sol: r4.st, hard: r4.hard }; } continue; }
    if (res.hard < Math.min(maxLvl, 3) && t < 40) continue;   // prefer puzzles that use the allowed tricks
    return { N, reg, sol: res.st, hard: res.hard };
  }
  return fallback;
}

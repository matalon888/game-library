// cagegen.js — math cage puzzle generator (Latin square + arithmetic cages). Our own code, MIT.
// generate(n, rand, hard) → { n, sol: [n*n], cages: [{ cells, op, target }], cageOf: [n*n] } with exactly one solution.
// Each cage's legal fillings are enumerated up front; the solver fills whole cages (fewest options first) against row and
// column masks and stops at 2 solutions, which is how uniqueness is proven.
export const OPS = { '+': '+', '-': '−', 'x': '×', '/': '÷', '': '' };

function latin(n, rand) {
  const perm = (k) => { const a = Array.from({ length: k }, (_, i) => i); for (let i = k - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const R = perm(n), C = perm(n), S = perm(n), out = new Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[r * n + c] = S[(R[r] + C[c]) % n] + 1;
  // a few random "intercalate" swaps so it isn't always a shifted cyclic square
  for (let t = 0; t < n * 6; t++) {
    const r1 = Math.floor(rand() * n), r2 = Math.floor(rand() * n), c1 = Math.floor(rand() * n), c2 = Math.floor(rand() * n);
    if (r1 === r2 || c1 === c2) continue;
    const a = out[r1 * n + c1], b = out[r1 * n + c2];
    if (out[r2 * n + c1] === b && out[r2 * n + c2] === a) { out[r1 * n + c1] = b; out[r1 * n + c2] = a; out[r2 * n + c1] = a; out[r2 * n + c2] = b; }
  }
  return out;
}
function partition(n, rand, hard) {
  const cageOf = new Array(n * n).fill(-1), cages = [];
  const order = Array.from({ length: n * n }, (_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const nbs = (c) => { const r = (c / n) | 0, k = c % n, o = []; if (r > 0) o.push(c - n); if (r < n - 1) o.push(c + n); if (k > 0) o.push(c - 1); if (k < n - 1) o.push(c + 1); return o; };
  // size weights: harder puzzles get fewer single cells and more 3–4 cell cages
  const w1 = Math.max(0.02, 0.12 - hard * 0.05), w3 = 0.28 + hard * 0.1, w4 = 0.07 + hard * 0.08, w2 = 1 - w1 - w3 - w4;
  for (const s of order) {
    if (cageOf[s] >= 0) continue;
    const x = rand(), want = x < w1 ? 1 : x < w1 + w2 ? 2 : x < w1 + w2 + w3 ? 3 : 4;
    const id = cages.length, cells = [s]; cageOf[s] = id;
    while (cells.length < want) {
      const fr = []; for (const c of cells) for (const m of nbs(c)) if (cageOf[m] < 0 && !fr.includes(m)) fr.push(m);
      if (!fr.length) break; const m = fr[Math.floor(rand() * fr.length)]; cageOf[m] = id; cells.push(m);
    }
    cages.push({ cells });
  }
  // stray single cells (growth got boxed in): most join a small neighbouring cage, so givens stay rare
  for (const cg of cages) {
    if (cg.cells.length !== 1 || rand() < w1 * 2.5) continue;
    const c = cg.cells[0], opts = nbs(c).map(m => cages[cageOf[m]]).filter(o => o !== cg && o.cells.length < 4 && o.cells.length > 0);
    if (!opts.length) continue;
    opts.sort((a, b) => a.cells.length - b.cells.length); const to = opts[0];
    to.cells.push(c); cageOf[c] = cages.indexOf(to); cg.cells = [];
  }
  const live = cages.filter(cg => cg.cells.length), map = new Map(live.map((cg, i) => [cg, i]));
  for (const cg of live) for (const c of cg.cells) cageOf[c] = map.get(cg);
  return { cages: live, cageOf };
}
function pickOp(cage, sol, rand, n) {
  const v = cage.cells.map(c => sol[c]);
  if (v.length === 1) return { op: '', target: v[0] };
  if (v.length === 2) {
    const hi = Math.max(...v), lo = Math.min(...v), x = rand();
    if (hi % lo === 0 && x < 0.45) return { op: '/', target: hi / lo };
    if (x < 0.7) return { op: '-', target: hi - lo };
    return x < 0.85 ? { op: '+', target: hi + lo } : { op: 'x', target: hi * lo };
  }
  const prod = v.reduce((a, b) => a * b, 1);
  return rand() < 0.5 && prod <= (n <= 4 ? 96 : 400) ? { op: 'x', target: prod } : { op: '+', target: v.reduce((a, b) => a + b, 0) };
}
function fits(op, target, vals) {
  if (op === '') return vals[0] === target;
  if (op === '+') return vals.reduce((a, b) => a + b, 0) === target;
  if (op === 'x') return vals.reduce((a, b) => a * b, 1) === target;
  const hi = Math.max(...vals), lo = Math.min(...vals);
  return op === '-' ? hi - lo === target : hi === lo * target;
}
export function tuples(n, cage) {
  const cs = cage.cells, out = [], cur = [];
  (function rec(k) {
    if (k === cs.length) { if (fits(cage.op, cage.target, cur)) out.push(cur.slice()); return; }
    for (let v = 1; v <= n; v++) {
      let ok = true; for (let j = 0; j < k; j++) if (cur[j] === v && (((cs[j] / n) | 0) === ((cs[k] / n) | 0) || cs[j] % n === cs[k] % n)) { ok = false; break; }
      if (ok) { cur[k] = v; rec(k + 1); }
    }
  })(0);
  return out;
}
/** count solutions (stops at `limit`); returns { count, sols } */
export function countSolutions(n, cages, limit = 2) {
  const T = cages.map(c => tuples(n, c)), rowM = new Int32Array(n), colM = new Int32Array(n), done = new Uint8Array(cages.length), grid = new Array(n * n).fill(0), sols = [];
  let count = 0, nodes = 0;
  const ok = (ci, t) => { const cs = cages[ci].cells; for (let k = 0; k < cs.length; k++) { const b = 1 << t[k], r = (cs[k] / n) | 0, c = cs[k] % n; if ((rowM[r] & b) || (colM[c] & b)) return false; } return true; };
  (function rec() {
    if (count >= limit || nodes > 400000) return; nodes++;
    let best = -1, bl = null;
    for (let i = 0; i < cages.length; i++) if (!done[i]) { const l = T[i].filter(t => ok(i, t)); if (!l.length) return; if (!bl || l.length < bl.length) { best = i; bl = l; if (l.length === 1) break; } }
    if (best < 0) { count++; sols.push(grid.slice()); return; }
    const cs = cages[best].cells; done[best] = 1;
    for (const t of bl) {
      for (let k = 0; k < cs.length; k++) { const b = 1 << t[k]; rowM[(cs[k] / n) | 0] |= b; colM[cs[k] % n] |= b; grid[cs[k]] = t[k]; }
      rec();
      for (let k = 0; k < cs.length; k++) { const b = ~(1 << t[k]); rowM[(cs[k] / n) | 0] &= b; colM[cs[k] % n] &= b; grid[cs[k]] = 0; }
      if (count >= limit) break;
    }
    done[best] = 0;
  })();
  return { count: nodes > 400000 ? limit : count, sols };
}
export function generate(n, rand, hard = 0.5) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const sol = latin(n, rand), { cages, cageOf } = partition(n, rand, hard);
    for (const c of cages) Object.assign(c, pickOp(c, sol, rand, n));
    // repair: while two solutions exist, re-pick the operation of a cage where they differ (a few times), else split that cell off
    let ok = false;
    for (let fix = 0; fix < 12; fix++) {
      const r = countSolutions(n, cages, 2);
      if (r.count === 1) { ok = true; break; }
      if (r.count === 0) break;
      const [s1, s2] = r.sols, diff = s1.findIndex((v, i) => v !== s2[i]), ci = cageOf[diff], cage = cages[ci];
      if (fix < 6 && cage.cells.length > 1) Object.assign(cage, pickOp(cage, sol, rand, n));
      else break;
    }
    if (ok) return { n, sol, cages, cageOf };
  }
  return null;
}

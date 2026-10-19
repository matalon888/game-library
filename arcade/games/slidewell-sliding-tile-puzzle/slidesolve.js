// slidesolve.js — sliding tile puzzle helpers. Our own code, MIT.
// Board: array of n*n, tiles 1..n*n-1, 0 = gap. Solved: tile v at index v-1, gap last.
// solve() places tiles layer by layer (top rows left to right, then the last two rows column by column). Each step is an exact
// breadth-first search over (gap, tile[, tile]) positions inside the still-free area, so it never gets stuck; the last tile of a
// row / column is placed together with its neighbour, the classic trick. Not shortest, but always finishes, for any size.

export function solvable(a, n) {
  let inv = 0; const t = a.filter(v => v);
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i] > t[j]) inv++;
  if (n % 2) return inv % 2 === 0;
  const gapRowFromBottom = n - Math.floor(a.indexOf(0) / n);
  return (inv + gapRowFromBottom) % 2 === 1;
}
export function isSolved(a) { for (let i = 0; i < a.length - 1; i++) if (a[i] !== i + 1) return false; return a[a.length - 1] === 0; }
/** seeded solvable shuffle that is far from solved */
export function shuffled(n, rand) {
  const N2 = n * n;
  for (let tries = 0; tries < 50; tries++) {
    const a = Array.from({ length: N2 }, (_, i) => (i + 1) % N2);
    for (let i = N2 - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (!solvable(a, n)) { // swap two tiles (not the gap) to flip parity
      const i = a[0] && a[1] ? 0 : 2, j = a[0] && a[1] ? 1 : 3; [a[i], a[j]] = [a[j], a[i]];
    }
    let misplaced = 0; for (let i = 0; i < N2; i++) if (a[i] && a[i] !== i + 1) misplaced++;
    if (solvable(a, n) && misplaced >= N2 - 3) return a;
  }
  const a = Array.from({ length: N2 }, (_, i) => (i + 1) % N2); [a[0], a[1]] = [a[1], a[0]]; [a[2], a[3]] = [a[3], a[2]]; return a;
}

function place(a, n, locked, targets, gapGoal) {
  const N2 = n * n, k = targets.length;
  const tiles = targets.map(t => t.tile), goal = targets.map(t => t.at);
  const p0 = tiles.map(t => a.indexOf(t)), g0 = a.indexOf(0);
  if (p0.every((p, i) => p === goal[i]) && (gapGoal === undefined || g0 === gapGoal)) return [];
  const enc = (g, p1, p2) => g + N2 * (p1 + N2 * (k > 1 ? p2 : 0));
  const size = N2 * N2 * (k > 1 ? N2 : 1), prev = new Int32Array(size).fill(-1);
  const s0 = enc(g0, p0[0], p0[1]); prev[s0] = s0;
  const q = [s0]; let found = -1;
  const nbs = (c) => { const r = (c / n) | 0, col = c % n, o = []; if (r > 0) o.push(c - n); if (r < n - 1) o.push(c + n); if (col > 0) o.push(c - 1); if (col < n - 1) o.push(c + 1); return o; };
  for (let h = 0; h < q.length && found < 0; h++) {
    const s = q[h], g = s % N2, p1 = Math.floor(s / N2) % N2, p2 = k > 1 ? Math.floor(s / (N2 * N2)) : 0;
    for (const m of nbs(g)) {
      if (locked[m]) continue;
      let q1 = p1, q2 = p2; if (m === p1) q1 = g; else if (k > 1 && m === p2) q2 = g;
      const ns = enc(m, q1, q2); if (prev[ns] >= 0) continue; prev[ns] = s; q.push(ns);
      if (q1 === goal[0] && (k < 2 || q2 === goal[1]) && (gapGoal === undefined || m === gapGoal)) { found = ns; break; }
    }
  }
  if (found < 0) return null;
  const path = []; for (let s = found; s !== s0; s = prev[s]) path.push(s % N2);
  path.reverse();
  for (const m of path) { const g = a.indexOf(0); a[g] = a[m]; a[m] = 0; }   // apply: gap moves to m
  return path;
}
/** full solution as the list of cells the gap moves into (= the tile at that cell slides into the gap). null if impossible. */
export function solve(start, n) {
  const a = start.slice(), locked = new Uint8Array(n * n), out = [];
  const at = (r, c) => r * n + c, tileAt = (r, c) => r * n + c + 1;
  const step = (targets, gapGoal) => { const p = place(a, n, locked, targets, gapGoal); if (!p) return false; out.push(...p); for (const t of targets) locked[t.at] = 1; return true; };
  for (let r = 0; r < n - 2; r++) {
    for (let c = 0; c < n - 2; c++) if (!step([{ tile: tileAt(r, c), at: at(r, c) }])) return null;
    if (!step([{ tile: tileAt(r, n - 2), at: at(r, n - 2) }, { tile: tileAt(r, n - 1), at: at(r, n - 1) }])) return null;
  }
  for (let c = 0; c < n - 2; c++) if (!step([{ tile: tileAt(n - 2, c), at: at(n - 2, c) }, { tile: tileAt(n - 1, c), at: at(n - 1, c) }])) return null;
  const last = [{ tile: tileAt(n - 2, n - 2), at: at(n - 2, n - 2) }, { tile: tileAt(n - 2, n - 1), at: at(n - 2, n - 1) }];
  const p = place(a, n, locked, last, n * n - 1); if (!p) return null; out.push(...p);
  return isSolved(a) ? out : null;
}

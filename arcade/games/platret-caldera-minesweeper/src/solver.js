/* ============================================================
   solver.js — constraint deduction for the Hint feature.
   Only ever reports PROVABLY-certain moves (single-cell logic +
   subset rule). If nothing is certain it says so honestly.
   ============================================================ */

import { isRevealed, isFlagged } from "./board.js";

/**
 * Analyze the current board.
 * @returns {{safe:number[], mines:number[]}} provably-safe covered cells
 *          and provably-mined covered cells.
 */
export function analyze(engine) {
  const { state: s, adjacency: adj, totalCells } = engine;
  const safe = new Set();
  const mines = new Set();

  // Build constraints: for each revealed number, the set of covered
  // (unrevealed, unflagged) neighbors must contain exactly `need` mines.
  const constraints = [];
  for (let i = 0; i < totalCells; i++) {
    if (!isRevealed(s, i) || adj[i] === 0) continue;
    const covered = [];
    let flagged = 0;
    for (const n of engine.neighbors(i)) {
      if (isFlagged(s, n)) flagged++;
      else if (!isRevealed(s, n)) covered.push(n);
    }
    if (covered.length === 0) continue;
    const need = adj[i] - flagged;
    if (need <= 0) covered.forEach((c) => safe.add(c));
    else if (need >= covered.length) covered.forEach((c) => mines.add(c));
    constraints.push({ set: covered, need });
  }

  // Subset rule: if set A ⊂ set B, then (B\A) holds (needB - needA) mines.
  for (let a = 0; a < constraints.length; a++) {
    for (let b = 0; b < constraints.length; b++) {
      if (a === b) continue;
      const A = constraints[a], B = constraints[b];
      if (A.set.length >= B.set.length) continue;
      const setA = new Set(A.set);
      if (!A.set.every((x) => B.set.includes(x))) continue;
      const diff = B.set.filter((x) => !setA.has(x));
      const need = B.need - A.need;
      if (need === 0) diff.forEach((c) => safe.add(c));
      else if (need === diff.length) diff.forEach((c) => mines.add(c));
    }
  }

  return { safe: [...safe], mines: [...mines] };
}

/**
 * Pick one provably-safe covered cell to reveal as a hint, or null.
 */
export function hint(engine) {
  const { safe } = analyze(engine);
  for (const i of safe) {
    if (!isRevealed(engine.state, i) && !isFlagged(engine.state, i)) return i;
  }
  return null;
}

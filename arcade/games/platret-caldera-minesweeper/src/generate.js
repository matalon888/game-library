/* ============================================================
   generate.js — "no-guess" board generation.

   Produces a mine layout that is fully solvable from the first
   opening using ONLY provable deductions (the same logic the Hint
   solver uses) — so a careful player never has to guess. It works
   by rejection sampling: lay mines down, simulate a logical solve,
   keep the first layout that solves cleanly. Falls back to null
   (→ a plain random board) if it can't find one in the attempt cap.
   ============================================================ */

import { analyze } from "./solver.js";
import {
  isMine, isRevealed, isFlagged,
  setMine, setRevealed, setFlagged,
} from "./board.js";

/** Returns an Engine `mineGenerator` that yields no-guess layouts. */
export function makeNoGuessGenerator() {
  return (engine, safeIdx) => noGuessLayout(engine, safeIdx);
}

export function noGuessLayout(engine, safeIdx) {
  const { totalCells, mineCount } = engine;
  const rand = engine._rand;
  const safeCells = totalCells - mineCount;
  const attempts = totalCells > 400 ? 25 : 60;

  // Always reserve the clicked cell + its neighbors so the first click is a
  // flood opening — that gives the solver something to chew on immediately.
  const forbidden = new Set([safeIdx]);
  for (const n of engine.neighbors(safeIdx)) forbidden.add(n);
  if (totalCells - forbidden.size < mineCount) { forbidden.clear(); forbidden.add(safeIdx); }

  const basePool = [];
  for (let i = 0; i < totalCells; i++) if (!forbidden.has(i)) basePool.push(i);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const pool = basePool.slice();
    const layout = [];
    for (let k = 0; k < mineCount; k++) {
      const j = k + Math.floor(rand() * (pool.length - k));
      const tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
      layout.push(pool[k]);
    }
    if (isSolvable(engine, layout, safeIdx, safeCells)) return layout;
  }
  return null;
}

/** Simulate a purely-logical solve; true if it clears without guessing. */
function isSolvable(engine, layout, safeIdx, safeCells) {
  const { totalCells } = engine;
  const adjacency = new Uint8Array(totalCells);
  const mineSet = new Set(layout);
  for (const m of layout) for (const n of engine.neighbors(m)) adjacency[n]++;

  const sim = {
    totalCells,
    adjacency,
    state: new Uint8Array(totalCells),
    neighbors: (i) => engine.neighbors(i),
  };
  for (const m of mineSet) setMine(sim.state, m);

  let revealed = 0;
  const flood = (start) => {
    const s = sim.state;
    if (isRevealed(s, start) || isFlagged(s, start) || isMine(s, start)) return;
    const stack = [start];
    setRevealed(s, start); revealed++;
    while (stack.length) {
      const i = stack.pop();
      if (adjacency[i] !== 0) continue;
      for (const n of engine.neighbors(i)) {
        if (!isRevealed(s, n) && !isFlagged(s, n) && !isMine(s, n)) {
          setRevealed(s, n); revealed++;
          stack.push(n);
        }
      }
    }
  };

  flood(safeIdx);

  let progress = true;
  while (progress && revealed < safeCells) {
    progress = false;
    const { safe, mines } = analyze(sim);
    for (const m of mines) {
      if (!isFlagged(sim.state, m) && !isRevealed(sim.state, m)) { setFlagged(sim.state, m); progress = true; }
    }
    for (const sfe of safe) {
      if (!isRevealed(sim.state, sfe) && !isFlagged(sim.state, sfe) && !isMine(sim.state, sfe)) {
        flood(sfe); progress = true;
      }
    }
  }
  return revealed === safeCells;
}

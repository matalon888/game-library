/* ============================================================
   metrics.js — board difficulty metrics (3BV) + derived scores.

   3BV ("Bechtel's Board Benchmark Value") is the minimum number of
   left-clicks needed to clear a board with no chording:
     - every empty (zero-adjacency) OPENING counts once, and
     - every numbered cell NOT touching any opening counts once.
   It's the standard yardstick for comparing solve speed across boards.
   ============================================================ */

import { isMine } from "./board.js";

/**
 * Compute the 3BV of a placed board.
 * @param {{totalCells:number, adjacency:Uint8Array, state:Uint8Array, neighbors:(i:number)=>number[]}} engine
 * @returns {number}
 */
export function compute3BV(engine) {
  const { totalCells, adjacency: adj, state: s } = engine;
  const seen = new Uint8Array(totalCells); // part of (or counted by) an opening
  let openings = 0;

  // 1. each connected region of zero-adjacency cells is one opening;
  //    flood it and mark the numbered border as "covered" too.
  for (let i = 0; i < totalCells; i++) {
    if (adj[i] !== 0 || isMine(s, i) || seen[i]) continue;
    openings++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop();
      for (const n of engine.neighbors(c)) {
        if (isMine(s, n)) continue;
        if (adj[n] === 0) {
          if (!seen[n]) { seen[n] = 1; stack.push(n); }
        } else {
          seen[n] = 1; // numbered border cell, opened for free by the flood
        }
      }
    }
  }

  // 2. numbered cells not adjacent to any opening each cost one click.
  let isolated = 0;
  for (let i = 0; i < totalCells; i++) {
    if (isMine(s, i) || adj[i] === 0 || seen[i]) continue;
    isolated++;
  }

  return openings + isolated;
}

/** clicks-per-3BV efficiency as a 0..1 ratio (or null if no clicks). */
export function efficiency(threeBV, clicks) {
  if (!clicks || !threeBV) return null;
  return threeBV / clicks;
}

/** 3BV solved per second (or null). */
export function threeBVPerSecond(threeBV, timeMs) {
  if (!threeBV || !timeMs) return null;
  return threeBV / (timeMs / 1000);
}

// rules.js — backgammon rules (the public-domain race game) for Pointrun, plus the computer's position judge.
// Positions are "relative": the side to move has positive checkers that run from 24 down to 1 and bear off to 0;
// its bar is point 25. The opponent's checkers are negative and run the other way. Our own code, MIT.

export const START = () => { const b = new Array(26).fill(0); b[24] = 2; b[13] = 5; b[8] = 3; b[6] = 5; b[1] = -2; b[12] = -5; b[17] = -3; b[19] = -5; return { b, bar: 0, obar: 0, off: 0, ooff: 0 }; };
export const copy = (R) => ({ b: R.b.slice(), bar: R.bar, obar: R.obar, off: R.off, ooff: R.ooff });
export const key = (R) => R.b.join(',') + '|' + R.bar + '|' + R.obar + '|' + R.off + '|' + R.ooff;
/** the same position seen by the other side */
export function flip(R) { const b = new Array(26).fill(0); for (let i = 1; i <= 24; i++) b[i] = -R.b[25 - i]; return { b, bar: R.obar, obar: R.bar, off: R.ooff, ooff: R.off }; }

const allHome = (R) => { if (R.bar) return false; for (let i = 7; i <= 24; i++) if (R.b[i] > 0) return false; return true; };
export function movesFor(R, die) {
  const out = [];
  if (R.bar > 0) { const d = 25 - die; if (R.b[d] >= -1) out.push({ from: 25, to: d, die, hit: R.b[d] === -1 }); return out; }
  const home = allHome(R);
  for (let s = 24; s >= 1; s--) {
    if (R.b[s] <= 0) continue;
    const d = s - die;
    if (d >= 1) { if (R.b[d] >= -1) out.push({ from: s, to: d, die, hit: R.b[d] === -1 }); }
    else if (home) {
      if (d === 0) out.push({ from: s, to: 0, die, hit: false });
      else { let higher = false; for (let i = s + 1; i <= 6; i++) if (R.b[i] > 0) { higher = true; break; } if (!higher) out.push({ from: s, to: 0, die, hit: false }); }
    }
  }
  return out;
}
export function apply(R, m) {
  const N = copy(R);
  if (m.from === 25) N.bar--; else N.b[m.from]--;
  if (m.to === 0) N.off++;
  else { if (N.b[m.to] === -1) { N.b[m.to] = 0; N.obar++; } N.b[m.to]++; }
  return N;
}
const without = (dice, d) => { const i = dice.indexOf(d); const a = dice.slice(); a.splice(i, 1); return a; };
const uniq = (dice) => [...new Set(dice)];

const memo = new Map();
export function maxLen(R, dice) {
  if (!dice.length) return 0;
  const k = key(R) + '#' + dice.slice().sort().join('');
  if (memo.has(k)) return memo.get(k);
  let best = 0;
  for (const d of uniq(dice)) {
    for (const m of movesFor(R, d)) { const v = 1 + maxLen(apply(R, m), without(dice, d)); if (v > best) best = v; if (best === dice.length) break; }
    if (best === dice.length) break;
  }
  if (memo.size > 200000) memo.clear();
  memo.set(k, best);
  return best;
}
/** legal next single moves: they must keep the most dice playable; with one die playable of two, the larger one */
export function legalNext(R, dice, turnDice) {
  const L = maxLen(R, dice); if (!L) return [];
  let out = [];
  for (const d of uniq(dice)) for (const m of movesFor(R, d)) if (1 + maxLen(apply(R, m), without(dice, d)) === L) out.push(m);
  if (L === 1 && dice.length === 2 && dice[0] !== dice[1] && turnDice && turnDice.length === 2) {
    const hi = Math.max(...dice); if (out.some(m => m.die === hi)) out = out.filter(m => m.die === hi);
  }
  return out;
}
/** every distinct finishing position for a roll (for the computer): [{ moves, R }] */
export function sequences(R, dice) {
  const L = maxLen(R, dice), res = new Map();
  const rec = (S, ds, path) => {
    if (path.length === L) { const k = key(S); if (!res.has(k)) res.set(k, { moves: path, R: S }); return; }
    for (const m of legalNext(S, ds, path.length ? null : dice)) rec(apply(S, m), without(ds, m.die), path.concat([m]));
  };
  rec(R, dice, []);
  if (!res.size) return [{ moves: [], R }];
  return [...res.values()];
}
export const pips = (R) => { let me = R.bar * 25, op = R.obar * 25; for (let i = 1; i <= 24; i++) { if (R.b[i] > 0) me += R.b[i] * i; else if (R.b[i] < 0) op += -R.b[i] * (25 - i); } return { me, op }; };

// chance (out of 36) that a single checker is hit from a given distance
const SHOT = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];
/** how good a position is for the side that just moved (bigger = better) */
export function judge(R, full = true) {
  const { me, op } = pips(R);
  let s = (op - me) + R.off * 1.2 - R.ooff * 1.2;
  if (!full) return s;
  let myBack = R.bar ? 25 : 0, oppFront = R.obar ? 0 : 25;
  for (let i = 1; i <= 24; i++) { if (R.b[i] > 0) myBack = Math.max(myBack, i); if (R.b[i] < 0) oppFront = Math.min(oppFront, i); }
  if (oppFront >= myBack) return s * 1.3 + R.off * 2;           // pure race
  // blots the opponent can hit (opponent checkers move upward, from its bar at 0)
  for (let p = 1; p <= 24; p++) {
    if (R.b[p] !== 1) continue;
    let miss = 1;
    if (R.obar) miss *= 1 - SHOT[p] / 36;
    for (let q = 1; q < p; q++) if (R.b[q] < 0 && p - q <= 24) miss *= 1 - SHOT[p - q] / 36;
    const hitP = 1 - miss; if (hitP > 0) s -= hitP * (4 + (25 - p) * 0.45);
  }
  // made points, the home board, primes, anchors
  let run = 0, bestRun = 0, home = 0;
  for (let p = 1; p <= 24; p++) {
    const v = R.b[p];
    if (v >= 2) { s += 1.5; if (p <= 6) { s += 2; home++; } if (p >= 4 && p <= 8) s += 1; if (p >= 19) s += 1.2; if (v > 5) s -= (v - 5) * 0.6; run++; bestRun = Math.max(bestRun, run); }
    else run = 0;
  }
  if (bestRun >= 3) s += (bestRun - 2) * 3;
  if (R.obar) s += R.obar * (2 + home * 1.6);
  if (R.bar) s -= R.bar * 3;
  return s;
}

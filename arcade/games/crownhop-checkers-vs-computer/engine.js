// engine.js — Crownhop checkers rules + CPU (no DOM; used by the page and by ai-worker.js). Our own code, MIT.
// American checkers / English draughts on 8×8: men move diagonally forward, captures are forced, multi-jumps must be
// finished, a man that reaches the far row is crowned (and its move ends), kings move and jump both ways.
// Cells 0..63, row = i >> 3. Side +1 = you (bottom, moving up), −1 = CPU (top, moving down). Man = ±1, king = ±2.
export const dark = (i) => (((i >> 3) + (i & 7)) & 1) === 1;
export function initial() {
  const b = new Array(64).fill(0);
  for (let i = 0; i < 64; i++) if (dark(i)) { const r = i >> 3; if (r < 3) b[i] = -1; else if (r > 4) b[i] = 1; }
  return b;
}
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const at = (r, c) => (r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c);

/** all legal moves for `side`: { path: [from, to, (to2...)], caps: [cells], crown: bool } — captures are forced */
export function moves(b, side) {
  const jumps = [], steps = [];
  for (let i = 0; i < 64; i++) {
    const v = b[i]; if (!v || Math.sign(v) !== side) continue;
    const king = Math.abs(v) === 2, r = i >> 3, c = i & 7;
    jumpFrom(b, i, v, [i], [], jumps);
    for (const [dr, dc] of DIRS) {
      if (!king && dr !== -side) continue;
      const t = at(r + dr, c + dc); if (t >= 0 && !b[t]) steps.push({ path: [i, t], caps: [], crown: !king && ((t >> 3) === (side > 0 ? 0 : 7)) });
    }
  }
  return jumps.length ? jumps : steps;
}
function jumpFrom(b, i, v, path, caps, out) {
  const side = Math.sign(v), king = Math.abs(v) === 2, r = i >> 3, c = i & 7; let any = false;
  for (const [dr, dc] of DIRS) {
    if (!king && dr !== -side) continue;
    const m = at(r + dr, c + dc), t = at(r + 2 * dr, c + 2 * dc);
    if (m < 0 || t < 0 || b[t] || !b[m] || Math.sign(b[m]) === side || caps.includes(m)) continue;
    any = true;
    const crown = !king && (t >> 3) === (side > 0 ? 0 : 7);
    const from = path[0], save = b[from]; b[from] = 0;           // the jumping piece has left its start square
    if (crown) out.push({ path: [...path, t], caps: [...caps, m], crown: true });   // crowning ends the move
    else jumpFrom(b, t, v, [...path, t], [...caps, m], out);
    b[from] = save;
  }
  if (!any && caps.length) out.push({ path, caps, crown: false });
}
export function apply(b, mv) {
  const nb = b.slice(), from = mv.path[0], to = mv.path[mv.path.length - 1], v = nb[from];
  nb[from] = 0; for (const c of mv.caps) nb[c] = 0;
  nb[to] = mv.crown ? 2 * Math.sign(v) : v;
  return nb;
}

// ---------------------------------------------------------------- CPU
function evaluate(b, side) {
  let s = 0, pieces = 0; const mat = [0, 0];
  for (let i = 0; i < 64; i++) {
    const v = b[i]; if (!v) continue; pieces++;
    const sg = Math.sign(v), r = i >> 3, c = i & 7;
    let x = Math.abs(v) === 2 ? 165 : 100;
    if (Math.abs(v) === 1) { x += (sg > 0 ? 7 - r : r) * 3; if ((sg > 0 && r === 7) || (sg < 0 && r === 0)) x += 6; }   // advance, guard the back row
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) x += 4;
    s += sg * x; mat[sg > 0 ? 0 : 1] += x;
  }
  // endgame: the side ahead trades down and walks its kings toward the enemy (so won endings get finished)
  const lead = mat[0] - mat[1];
  if (Math.abs(lead) >= 90 && pieces <= 10) {
    const w = lead > 0 ? 1 : -1; let near = 0;
    for (let i = 0; i < 64; i++) if (b[i] === 2 * w) { let d = 99; for (let j = 0; j < 64; j++) if (Math.sign(b[j]) === -w) d = Math.min(d, Math.max(Math.abs((i >> 3) - (j >> 3)), Math.abs((i & 7) - (j & 7)))); if (d < 99) near += d; }
    s += w * ((12 - pieces) * 8 - near * 3);
  }
  return s * side;
}
const WIN = 100000;
export function search(b, side, { depth = 4, ms = 800, noise = 0, rand = Math.random, blunder = 0 } = {}) {
  const t0 = Date.now(); let nodes = 0, stop = false;
  function ab(bb, sd, d, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() - t0 > ms) stop = true;
    if (stop) return 0;
    const ms_ = moves(bb, sd);
    if (!ms_.length) return -WIN + ply;
    if (d <= 0 && !ms_[0].caps.length) return evaluate(bb, sd);
    if (d <= -6) return evaluate(bb, sd);
    ms_.sort((a, b2) => b2.caps.length - a.caps.length + (b2.crown - a.crown));
    let best = -WIN;
    for (const m of ms_) {
      const v = -ab(apply(bb, m), -sd, d - 1, -beta, -alpha, ply + 1);
      if (stop) return 0;
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
    }
    return best;
  }
  const root = moves(b, side); if (!root.length) return null;
  if (root.length === 1) return root[0];
  if (blunder && rand() < blunder) return root[Math.floor(rand() * root.length)];
  const jit = root.map(() => (noise ? (rand() * 2 - 1) * noise : 0));
  let best = root[0];
  for (let d = 1; d <= depth; d++) {
    let bs = -Infinity, bm = null;
    for (let k = 0; k < root.length; k++) {
      const v = -ab(apply(b, root[k]), -side, d - 1, -WIN - 1, WIN + 1, 1) + jit[k];
      if (stop) break;
      if (v > bs) { bs = v; bm = root[k]; }
    }
    if (stop) break;
    if (bm) best = bm;
    if (bs > WIN - 100 || Date.now() - t0 > ms * 0.4) break;
  }
  return best;
}
export function think({ b, side = -1, diff, seed, fk = 1 }) {
  const rand = mk(seed);
  const L = [{ depth: 2, ms: 200, noise: 45 / fk, blunder: 0.12 / fk }, { depth: 5, ms: 500 * fk, noise: 10 / fk }, { depth: 10, ms: 1300 * fk }][diff];
  return search(b, side, { ...L, rand });
}
function mk(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

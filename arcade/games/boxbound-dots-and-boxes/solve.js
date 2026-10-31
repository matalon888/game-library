// Dots and boxes exact solver (weights per box). Used by gen.mjs and for QA. Own code.
export function model(n) {
  const HN = (n + 1) * n, E = HN + n * (n + 1), boxEdges = [], edgeBoxes = Array.from({ length: E }, () => []);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const b = r * n + c, es = [r * n + c, (r + 1) * n + c, HN + r * (n + 1) + c, HN + r * (n + 1) + c + 1]; boxEdges[b] = es; es.forEach(e => edgeBoxes[e].push(b)); }
  return { n, HN, E, boxEdges, edgeBoxes };
}
// drawn: array of 0/1 (length E); w: box weights; returns { value, firsts: Map(edge -> value for mover) } mover = player to move
export function solve(m, drawn, w, cap = 3e6) {
  const free = []; for (let e = 0; e < m.E; e++) if (!drawn[e]) free.push(e);
  const F = free.length; if (F > 24) return null;
  const idx = new Map(free.map((e, i) => [e, i]));
  const nb = m.n * m.n;
  const baseSides = new Array(nb).fill(0); for (let b = 0; b < nb; b++) baseSides[b] = m.boxEdges[b].filter(e => drawn[e]).length;
  const bFree = Array.from({ length: nb }, (_, b) => m.boxEdges[b].filter(e => !drawn[e]).map(e => idx.get(e)));
  const eBox = free.map(e => m.edgeBoxes[e]);
  const memo = new Map(); let states = 0;
  // mask = bit set for DRAWN free edges. value = best (mover - other) from here.
  function f(mask) {
    if (mask === (1 << F) - 1 || (F === 31 && false)) return 0;
    const hit = memo.get(mask); if (hit !== undefined) return hit;
    if (++states > cap) throw new Error('cap');
    let best = -1e9;
    for (let i = 0; i < F; i++) {
      if (mask & (1 << i)) continue;
      const nm = mask | (1 << i); let gain = 0;
      for (const b of eBox[i]) { let cnt = baseSides[b]; for (const j of bFree[b]) if (nm & (1 << j)) cnt++; if (cnt === 4) gain += w[b]; }
      const v = gain > 0 ? gain + f(nm) : -f(nm);
      if (v > best) best = v;
    }
    memo.set(mask, best); return best;
  }
  const full = F === 0 ? 0 : (1 << F) - 1;
  const value = f(0);
  const firsts = new Map();
  for (let i = 0; i < F; i++) {
    const nm = 1 << i; let gain = 0;
    for (const b of eBox[i]) { let cnt = baseSides[b]; for (const j of bFree[b]) if (nm & (1 << j)) cnt++; if (cnt === 4) gain += w[b]; }
    firsts.set(free[i], gain > 0 ? gain + f(nm) : -f(nm));
  }
  return { value, firsts, free, states };
}

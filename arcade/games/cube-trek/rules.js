// Cube Trek deep v2 — pure rules (shared by the game and the level checker qa/solve.mjs). No DOM, no three.js.
// Board = 64 chars, row-major, 8×8.  '.' empty · '#' block · 'G' gem block · 'I' ice (two line clears) · 'i' cracked ice ·
// 'B' bomb block (when cleared it also clears the 8 cells around it).
export const N = 8;
// named pieces: cells are [x, y] (x right, y down) as in v1
export const SH = {
  d: [[0, 0]], h2: [[0, 0], [1, 0]], v2: [[0, 0], [0, 1]], h3: [[0, 0], [1, 0], [2, 0]], v3: [[0, 0], [0, 1], [0, 2]],
  h4: [[0, 0], [1, 0], [2, 0], [3, 0]], v4: [[0, 0], [0, 1], [0, 2], [0, 3]],
  h5: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], v5: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  sq: [[0, 0], [1, 0], [0, 1], [1, 1]], sq3: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  w3: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], t3: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  // small corners: nw = missing top-right ... named by the missing corner of the 2×2
  cNE: [[0, 0], [0, 1], [1, 1]], cNW: [[1, 0], [0, 1], [1, 1]], cSE: [[0, 0], [1, 0], [0, 1]], cSW: [[0, 0], [1, 0], [1, 1]],
  // L with a 3-long arm
  lA: [[0, 0], [0, 1], [0, 2], [1, 2]], lB: [[1, 0], [1, 1], [1, 2], [0, 2]], lC: [[0, 0], [1, 0], [2, 0], [0, 1]], lD: [[0, 0], [1, 0], [2, 0], [2, 1]],
  tU: [[0, 0], [1, 0], [2, 0], [1, 1]], tD: [[1, 0], [0, 1], [1, 1], [2, 1]],
  zH: [[0, 0], [1, 0], [1, 1], [2, 1]], sH: [[1, 0], [2, 0], [0, 1], [1, 1]],
  bigL: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], bigJ: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
};
export const dims = cells => [Math.max(...cells.map(c => c[0])) + 1, Math.max(...cells.map(c => c[1])) + 1];
export const parse = rows => rows.join('');
export const fits = (b, cells, r0, c0) => { for (const [x, y] of cells) { const r = r0 + y, c = c0 + x; if (r < 0 || c < 0 || r >= N || c >= N || b[r * N + c] !== '.') return false; } return true; };
export const anyFit = (b, cells) => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(b, cells, r, c)) return true; return false; };
export function fullLines(b) {
  const rows = [], cols = [];
  for (let r = 0; r < N; r++) { let f = true; for (let c = 0; c < N; c++) if (b[r * N + c] === '.') { f = false; break; } if (f) rows.push(r); }
  for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (b[r * N + c] === '.') { f = false; break; } if (f) cols.push(c); }
  return { rows, cols };
}
// place + clear, with cascades (a line that becomes full after a clear goes too: cracked ice keeps a line "full").
// Returns { b, lines, gems, ice, cleared:[[idx,kind]], cracked:[idx], blasts:[idx], passes }
export function place(b, cells, r0, c0) {
  const a = b.split(''); for (const [x, y] of cells) a[(r0 + y) * N + c0 + x] = '#';
  const out = { b: a.join(''), lines: 0, gems: 0, ice: 0, cleared: [], cracked: [], blasts: [], passes: 0 };
  for (let pass = 0; pass < 6; pass++) {
    const { rows, cols } = fullLines(a.join('')), n = rows.length + cols.length; if (!n) break;
    out.lines += n; out.passes++;
    const hit = new Set(); const q = [];
    for (const r of rows) for (let c = 0; c < N; c++) q.push(r * N + c);
    for (const c of cols) for (let r = 0; r < N; r++) q.push(r * N + c);
    while (q.length) {
      const i = q.pop(); if (hit.has(i)) continue; hit.add(i); const k = a[i];
      if (k === '.') continue;
      if (k === 'I') { a[i] = 'i'; out.cracked.push(i); continue; }
      if (k === 'i') out.ice++;
      if (k === 'G') out.gems++;
      out.cleared.push([i, k]); a[i] = '.';
      if (k === 'B') { out.blasts.push(i); const r = Math.floor(i / N), c = i % N; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < N && cc < N) q.push(rr * N + cc); } }
    }
  }
  out.b = a.join(''); return out;
}
export const count = (b, ch) => { let n = 0; for (const x of b) if (x === ch) n++; return n; };
// goal of a level from its board: gems = every gem, ice = every ice (both kinds), lines = n full lines
export function needs(L) {
  const b = parse(L.board);
  return { gems: L.goal.includes('gems') ? count(b, 'G') : 0, ice: L.goal.includes('ice') ? count(b, 'I') + count(b, 'i') : 0, lines: L.lines || 0 };
}
export const done = (n, got) => got.gems >= n.gems && got.ice >= n.ice && got.lines >= n.lines;

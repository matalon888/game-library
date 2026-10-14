// Pearl Tide — reel math. Fixed reel strips + paytable; RTP is computed exactly from these tables (no simulation, no tuning per player).
export const SYMS = [
  { id: 'glass', name: 'Sea Glass' }, { id: 'shell', name: 'Scallop' }, { id: 'drop', name: 'Dewdrop' }, { id: 'urchin', name: 'Urchin' },
  { id: 'star', name: 'Starfish' }, { id: 'jelly', name: 'Jelly' }, { id: 'puff', name: 'Puffer' }, { id: 'clam', name: 'Pearl Clam' },
  { id: 'wild', name: 'Tide Wild' }, { id: 'pearl', name: 'Moon Pearl' },
];
export const WILD = 8, SCAT = 9, ROWS = 3, REELS = 5, LINE_COUNT = 10;
// pays in line bets for 3 / 4 / 5 of a kind, left to right (wild substitutes for all but the pearl)
export const PAY = [
  [9, 25, 70], [10, 28, 80], [11, 35, 90], [13, 40, 120],
  [22, 70, 240], [28, 90, 350], [45, 140, 600], [70, 280, 1400],
  [90, 450, 2500], [0, 0, 0],
];
export const SCAT_PAY = { 3: 2, 4: 10, 5: 50 };      // pearls anywhere, in TOTAL bets
export const FS_AWARD = { 3: 8, 4: 12, 5: 15 };      // free spins (pearls retrigger during free spins)
export const FS_MULT = 2;                            // every free-spin win is doubled
// symbol counts per reel (32 stops each)
const COUNTS = [
  [6, 6, 5, 5, 3, 3, 2, 1, 0, 1],
  [5, 5, 5, 5, 3, 3, 2, 1, 2, 1],
  [5, 5, 5, 5, 3, 3, 2, 1, 2, 1],
  [5, 5, 5, 5, 3, 3, 2, 1, 2, 1],
  [6, 5, 5, 5, 3, 3, 2, 1, 1, 1],
];
export const LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 2, 1, 0, 1],
];
// deterministic strip layout (fixed, published): spread symbols with a seeded shuffle, keep identical symbols from touching where possible
function lcg(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function buildStrip(counts, seed) {
  const r = lcg(seed), bag = [];
  counts.forEach((n, s) => { for (let i = 0; i < n; i++) bag.push(s); });
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  for (let pass = 0; pass < 6; pass++) for (let i = 0; i < bag.length; i++) {        // break up neighbours
    const n = (i + 1) % bag.length; if (bag[i] !== bag[n]) continue;
    for (let j = 0; j < bag.length; j++) { const a = (j + bag.length - 1) % bag.length, b = (j + 1) % bag.length;
      if (bag[j] !== bag[n] && bag[a] !== bag[n] && bag[b] !== bag[n] && bag[(n + 1) % bag.length] !== bag[j] && bag[(n + bag.length - 1) % bag.length] !== bag[j]) { [bag[n], bag[j]] = [bag[j], bag[n]]; break; } }
  }
  return bag;
}
export const STRIPS = COUNTS.map((c, i) => buildStrip(c, 7919 * (i + 3)));

export function window3(stops) { return STRIPS.map((s, r) => [0, 1, 2].map(k => s[(stops[r] + k) % s.length])); }   // [reel][row]

export function payLine(sy) {
  if (sy[0] === SCAT) return { sym: -1, count: 0, pay: 0 };
  let wr = 0; while (wr < 5 && sy[wr] === WILD) wr++;
  const sym = wr === 5 ? WILD : sy[wr];
  let best = { sym: -1, count: 0, pay: 0 };
  if (sym !== SCAT) { let c = 0; while (c < 5 && (sy[c] === sym || sy[c] === WILD)) c++; if (c >= 3 && PAY[sym][c - 3]) best = { sym, count: c, pay: PAY[sym][c - 3] }; }
  if (wr >= 3 && PAY[WILD][wr - 3] > best.pay) best = { sym: WILD, count: wr, pay: PAY[WILD][wr - 3] };
  return best;
}

/** full evaluation of one spin. lineBet in chips; returns line wins (chips), scatter win (chips) and free spins awarded */
export function evaluate(stops, lineBet, mult = 1) {
  const w = window3(stops), lines = [];
  LINES.forEach((L, i) => { const r = payLine(L.map((row, reel) => w[reel][row])); if (r.pay) lines.push({ line: i, ...r, win: r.pay * lineBet * mult }); });
  const pearls = []; w.forEach((col, reel) => col.forEach((s, row) => s === SCAT && pearls.push([reel, row])));
  const n = pearls.length, total = lineBet * LINE_COUNT;
  const scat = { count: n, positions: pearls, win: (SCAT_PAY[Math.min(5, n)] || 0) * total * mult, spins: FS_AWARD[Math.min(5, n)] || 0 };
  const win = lines.reduce((a, l) => a + l.win, 0) + scat.win;
  return { grid: w, lines, scat, win };
}

/** exact return-to-player from the strips and paytable (per unit of total bet) */
export function computeRTP() {
  const P = STRIPS.map(s => { const p = new Array(SYMS.length).fill(0); s.forEach(x => p[x] += 1 / s.length); return p; });
  let lineEV = 0, lineHit = 0;   // per line, in line bets
  const sy = [0, 0, 0, 0, 0];
  const rec = (r, pr) => {
    if (r === 5) { const x = payLine(sy).pay; lineEV += pr * x; if (x) lineHit += pr; return; }
    for (let s = 0; s < SYMS.length; s++) if (P[r][s]) { sy[r] = s; rec(r + 1, pr * P[r][s]); }
  };
  rec(0, 1);
  // pearls: at most one per reel in view (strips keep them ≥3 apart), so each reel is a Bernoulli(3·n/32)
  let dist = [1];
  STRIPS.forEach((s, r) => { const q = Math.min(1, 3 * s.filter(x => x === SCAT).length / s.length), nd = new Array(dist.length + 1).fill(0);
    dist.forEach((p, k) => { nd[k] += p * (1 - q); nd[k + 1] += p * q; }); dist = nd; });
  const scatEV = dist.reduce((a, p, k) => a + p * (SCAT_PAY[Math.min(5, k)] || 0), 0);
  const trig = dist.reduce((a, p, k) => a + (k >= 3 ? p : 0), 0);
  const q = dist.reduce((a, p, k) => a + p * (FS_AWARD[Math.min(5, k)] || 0), 0);     // expected free spins per spin
  const baseEV = lineEV + scatEV;                        // lines: 10 lines × lineEV line bets = lineEV total bets
  const V = FS_MULT * baseEV / (1 - q);                  // value of one free spin incl. retriggers
  const fsEV = q * V;
  return { rtp: baseEV + fsEV, lines: lineEV, scatter: scatEV, free: fsEV, trigger: trig, lineHit, pearlDist: dist, avgFree: q / trig };
}
// share of base spins that pay anything (lines or pearls): exact count over all 32^5 = 33,554,432 stop combinations,
// enumerated offline with evaluate() — 10,987,326 winning combinations. Recompute if strips or paytable change.
export const HIT_COMBOS = 10987326, ALL_COMBOS = 32 ** 5;

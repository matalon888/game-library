// node makepack.mjs [seconds=120] [seed] [seed2 ...]  → pack.js  (several seeds run one after another; buckets merge)
// Builds Lotjam's graded level pack. Random 6×6 lots are improved by hill climbing (add / remove / move a vehicle and keep the
// change when the lot's hardest state gets harder). For every lot we explore all reachable states (BFS) and measure each
// state's shortest solution with a multi-source BFS from the solved states; the state with the longest shortest solution is
// the puzzle. Puzzles are stored as 36-char strings ('.' empty, 'A' red car, 'B'.. others), bucketed by solution length.
import fs from 'fs';
const N = 6, EXIT = 2, SECS = +(process.argv[2] || 120);
const P6 = [1]; for (let i = 1; i < 20; i++) P6.push(P6[i - 1] * 6);
const SEEDS = process.argv.slice(3).map(Number); let seed = SEEDS[0] || 12345; const rand = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };

const at = (v, p) => v.h ? v.line * N + p : p * N + v.line;
function explore(V, startPos) {
  const n = V.length, pos = new Int8Array(n), occ = new Int8Array(36);
  const code0 = startPos.reduce((a, p, i) => a + p * P6[i], 0);
  const idx = new Map([[code0, 0]]), codes = [code0], adj = [];
  for (let h = 0; h < codes.length; h++) {
    if (codes.length > 120000) return null;
    let c = codes[h]; for (let i = 0; i < n; i++) { pos[i] = c % 6; c = Math.floor(c / 6); }
    occ.fill(0); for (let i = 0; i < n; i++) for (let k = 0; k < V[i].len; k++) occ[at(V[i], pos[i] + k)] = 1;
    const list = [];
    for (let i = 0; i < n; i++) {
      const v = V[i], p0 = pos[i];
      for (let p = p0 - 1; p >= 0 && !occ[at(v, p)]; p--) list.push(codes[h] + (p - p0) * P6[i]);
      for (let p = p0 + 1; p + v.len - 1 < N && !occ[at(v, p + v.len - 1)]; p++) list.push(codes[h] + (p - p0) * P6[i]);
    }
    const li = [];
    for (const nc of list) { let j = idx.get(nc); if (j === undefined) { j = codes.length; idx.set(nc, j); codes.push(nc); } li.push(j); }
    adj.push(li);
  }
  // distances from solved states (red car index 0 at position 4)
  const dist = new Int16Array(codes.length).fill(-1), q = [];
  for (let j = 0; j < codes.length; j++) if (codes[j] % 6 === N - 2) { dist[j] = 0; q.push(j); }
  for (let h = 0; h < q.length; h++) for (const k of adj[q[h]]) if (dist[k] < 0) { dist[k] = dist[q[h]] + 1; q.push(k); }
  let best = -1, bd = -1; for (let j = 0; j < codes.length; j++) if (dist[j] > bd) { bd = dist[j]; best = j; }
  if (best < 0) return null;
  let c = codes[best]; const bp = []; for (let i = 0; i < n; i++) { bp.push(c % 6); c = Math.floor(c / 6); }
  return { d: bd, pos: bp, size: codes.length };
}
function occOf(V, pos, skip = -1) { const o = new Int8Array(36); V.forEach((v, i) => { if (i !== skip) for (let k = 0; k < v.len; k++) o[at(v, pos[i] + k)] = 1; }); return o; }
function tryAdd(V, pos) {
  const occ = occOf(V, pos);
  for (let t = 0; t < 60; t++) {
    const h = rand() < 0.5, len = rand() < 0.3 ? 3 : 2, line = Math.floor(rand() * N), p = Math.floor(rand() * (N - len + 1));
    if (h && line === EXIT) continue;
    const v = { h, len, line }; let ok = true; for (let k = 0; k < len; k++) if (occ[at(v, p + k)]) { ok = false; break; }
    if (ok) { V.push(v); pos.push(p); return true; }
  }
  return false;
}
function str(V, pos) { const s = new Array(36).fill('.'); V.forEach((v, i) => { for (let k = 0; k < v.len; k++) s[at(v, pos[i] + k)] = String.fromCharCode(65 + i); }); return s.join(''); }
function canon(V, pos) { // letters by first appearance after red so duplicates collapse
  const s = str(V, pos), map = { A: 'A', '.': '.' }; let nx = 66; return [...s].map(ch => map[ch] || (map[ch] = String.fromCharCode(nx++))).join('');
}

const buckets = new Map(), seen = new Set(), t0 = Date.now(); let lots = 0;
function keep(V, r) { if (r.d < 3) return; const k = canon(V, r.pos); if (seen.has(k)) return; seen.add(k); if (!buckets.has(r.d)) buckets.set(r.d, []); buckets.get(r.d).push(k); }
for (const sd of SEEDS.length ? SEEDS : [12345]) { seed = sd; const t1 = Date.now();
while ((Date.now() - t1) / 1000 < SECS) {
  lots++;
  let V = [{ h: true, len: 2, line: EXIT }], pos = [Math.floor(rand() * 3)];
  const want = 9 + Math.floor(rand() * 5); for (let k = 0; k < want; k++) tryAdd(V, pos);
  let cur = explore(V, pos); if (!cur) continue; keep(V, cur);
  V = V.slice(); pos = cur.pos.slice();
  for (let it = 0; it < 160; it++) {
    const V2 = V.map(v => ({ ...v })), p2 = pos.slice(), m = rand();
    if (m < 0.35 && V2.length > 6) { const i = 1 + Math.floor(rand() * (V2.length - 1)); V2.splice(i, 1); p2.splice(i, 1); }
    else if (m < 0.7) { if (!tryAdd(V2, p2)) continue; }
    else { // move a vehicle somewhere else
      const i = 1 + Math.floor(rand() * (V2.length - 1)); if (!V2[i]) continue; V2.splice(i, 1); p2.splice(i, 1); if (!tryAdd(V2, p2)) continue;
    }
    const r = explore(V2, p2); if (!r) continue;
    keep(V2, r);
    if (r.d >= cur.d) { V = V2; pos = r.pos; cur = r; }
  }
}
}
const counts = [...buckets.keys()].sort((a, b) => a - b).map(d => `${d}:${buckets.get(d).length}`);
console.log('lots', lots, counts.join(' '));
// keep up to 40 per solution length, shuffled deterministically
const out = {};
for (const [d, arr] of [...buckets].sort((a, b) => a[0] - b[0])) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  out[d] = arr.slice(0, 40).join('');
}
fs.writeFileSync(new URL('./pack.js', import.meta.url), `// Lotjam level pack, generated by makepack.mjs (BFS-graded). Key = shortest solution in moves; value = 36-char lots joined.\nexport const PACK = ${JSON.stringify(out)};\n`);

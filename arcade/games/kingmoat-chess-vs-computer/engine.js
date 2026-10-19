// engine.js — Kingmoat chess rules + CPU (no DOM; used by the page and by ai-worker.js). Our own code, MIT.
// 0x88 board, full legal rules: castling, en passant, promotion, check, mate, stalemate, 50-move rule, insufficient
// material (threefold repetition is tracked by the page). CPU: alpha-beta with quiescence, iterative deepening, killer moves.
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const ND = [-33, -31, -18, -14, 14, 18, 31, 33], BD = [-17, -15, 15, 17], RD = [-16, -1, 1, 16], KD = [-17, -15, 15, 17, -16, -1, 1, 16];
const CR = new Int8Array(128).fill(15); CR[0] = 13; CR[7] = 14; CR[4] = 12; CR[112] = 7; CR[119] = 11; CR[116] = 3;
export const sq = (file, rank) => rank * 16 + file;
export const fileOf = (s) => s & 7, rankOf = (s) => s >> 4;

export class Pos {
  constructor(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    this.b = new Int8Array(128); this.side = 1; this.castle = 0; this.ep = -1; this.half = 0; this.full = 1; this.k = { 1: 4, '-1': 116 };
    const [rows, side, cas, ep, half, full] = fen.split(' ');
    let r = 7, f = 0; const map = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
    for (const ch of rows) {
      if (ch === '/') { r--; f = 0; } else if (/\d/.test(ch)) f += +ch;
      else { const v = map[ch.toLowerCase()] * (ch === ch.toUpperCase() ? 1 : -1); this.b[sq(f, r)] = v; if (Math.abs(v) === KING) this.k[v > 0 ? 1 : -1] = sq(f, r); f++; }
    }
    this.side = side === 'b' ? -1 : 1;
    this.castle = (cas.includes('K') ? 1 : 0) | (cas.includes('Q') ? 2 : 0) | (cas.includes('k') ? 4 : 0) | (cas.includes('q') ? 8 : 0);
    this.ep = ep && ep !== '-' ? sq(ep.charCodeAt(0) - 97, +ep[1] - 1) : -1;
    this.half = +half || 0; this.full = +full || 1;
  }
  fen() {
    let s = ''; const ch = ' pnbrqk';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) { const v = this.b[sq(f, r)]; if (!v) { e++; continue; } if (e) { s += e; e = 0; } const c = ch[Math.abs(v)]; s += v > 0 ? c.toUpperCase() : c; }
      if (e) s += e; if (r) s += '/';
    }
    const c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '') || '-';
    const ep = this.ep >= 0 ? String.fromCharCode(97 + fileOf(this.ep)) + (rankOf(this.ep) + 1) : '-';
    return `${s} ${this.side > 0 ? 'w' : 'b'} ${c} ${ep} ${this.half} ${this.full}`;
  }
  key() { return this.fen().split(' ').slice(0, 4).join(' '); }   // repetition key

  attacked(s, by) {
    const b = this.b;
    if (by > 0) { if (!((s - 15) & 0x88) && b[s - 15] === 1) return true; if (!((s - 17) & 0x88) && b[s - 17] === 1) return true; }
    else { if (!((s + 15) & 0x88) && b[s + 15] === -1) return true; if (!((s + 17) & 0x88) && b[s + 17] === -1) return true; }
    for (const d of ND) { const t = s + d; if (!(t & 0x88) && b[t] === 2 * by) return true; }
    for (const d of KD) { const t = s + d; if (!(t & 0x88) && b[t] === 6 * by) return true; }
    for (const d of BD) { let t = s + d; while (!(t & 0x88)) { const v = b[t]; if (v) { if (v === 3 * by || v === 5 * by) return true; break; } t += d; } }
    for (const d of RD) { let t = s + d; while (!(t & 0x88)) { const v = b[t]; if (v) { if (v === 4 * by || v === 5 * by) return true; break; } t += d; } }
    return false;
  }
  inCheck(side = this.side) { return this.attacked(this.k[side], -side); }

  /** pseudo-legal moves {f,t,p,fl}: fl 1 = en passant, 2 = castle, 4 = double push; p = promotion piece */
  gen(caps = false) {
    const b = this.b, us = this.side, out = [];
    const add = (f, t, fl = 0) => {
      if (Math.abs(b[f]) === PAWN && (rankOf(t) === 7 || rankOf(t) === 0)) { out.push({ f, t, p: QUEEN, fl }); if (!caps) for (const p of [KNIGHT, ROOK, BISHOP]) out.push({ f, t, p, fl }); }
      else out.push({ f, t, p: 0, fl });
    };
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const v = b[s]; if (!v || (v > 0) !== (us > 0)) continue;
      const a = v * us;
      if (a === PAWN) {
        const dir = 16 * us, one = s + dir;
        if (!(one & 0x88) && !b[one]) {
          if (!caps || rankOf(one) === 7 || rankOf(one) === 0) add(s, one);
          if (!caps && rankOf(s) === (us > 0 ? 1 : 6) && !b[one + dir]) add(s, one + dir, 4);
        }
        for (const t of [one - 1, one + 1]) { if (t & 0x88) continue; if (b[t] * us < 0) add(s, t); else if (t === this.ep) add(s, t, 1); }
      } else if (a === KNIGHT || a === KING) {
        for (const d of a === KNIGHT ? ND : KD) { const t = s + d; if (t & 0x88) continue; const w = b[t]; if (w * us > 0) continue; if (caps && !w) continue; add(s, t); }
      } else {
        const dirs = a === BISHOP ? BD : a === ROOK ? RD : KD;
        for (const d of dirs) { let t = s + d; while (!(t & 0x88)) { const w = b[t]; if (w * us > 0) break; if (!caps || w) add(s, t); if (w) break; t += d; } }
      }
    }
    if (!caps) {
      if (us > 0) {
        if (this.castle & 1 && b[4] === 6 && b[7] === 4 && !b[5] && !b[6] && !this.attacked(4, -1) && !this.attacked(5, -1) && !this.attacked(6, -1)) out.push({ f: 4, t: 6, p: 0, fl: 2 });
        if (this.castle & 2 && b[4] === 6 && b[0] === 4 && !b[1] && !b[2] && !b[3] && !this.attacked(4, -1) && !this.attacked(3, -1) && !this.attacked(2, -1)) out.push({ f: 4, t: 2, p: 0, fl: 2 });
      } else {
        if (this.castle & 4 && b[116] === -6 && b[119] === -4 && !b[117] && !b[118] && !this.attacked(116, 1) && !this.attacked(117, 1) && !this.attacked(118, 1)) out.push({ f: 116, t: 118, p: 0, fl: 2 });
        if (this.castle & 8 && b[116] === -6 && b[112] === -4 && !b[113] && !b[114] && !b[115] && !this.attacked(116, 1) && !this.attacked(115, 1) && !this.attacked(114, 1)) out.push({ f: 116, t: 114, p: 0, fl: 2 });
      }
    }
    return out;
  }
  make(m) {
    const b = this.b, us = this.side, pc = b[m.f];
    const u = { m, cap: b[m.t], capSq: m.t, castle: this.castle, ep: this.ep, half: this.half };
    if (m.fl & 1) { u.capSq = m.t - 16 * us; u.cap = b[u.capSq]; b[u.capSq] = 0; }
    b[m.t] = m.p ? m.p * us : pc; b[m.f] = 0;
    if (m.fl & 2) { if (m.t > m.f) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = 0; } else { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = 0; } }
    if (Math.abs(pc) === KING) this.k[us] = m.t;
    this.castle &= CR[m.f] & CR[m.t];
    this.ep = m.fl & 4 ? m.f + 16 * us : -1;
    this.half = Math.abs(pc) === PAWN || u.cap ? 0 : this.half + 1;
    if (us < 0) this.full++;
    this.side = -us;
    return u;
  }
  unmake(u) {
    const b = this.b, m = u.m; this.side = -this.side; const us = this.side;
    const pc = m.p ? PAWN * us : b[m.t];
    b[m.f] = pc; b[m.t] = 0; if (u.cap) b[u.capSq] = u.cap;
    if (m.fl & 2) { if (m.t > m.f) { b[m.f + 3] = b[m.f + 1]; b[m.f + 1] = 0; } else { b[m.f - 4] = b[m.f - 1]; b[m.f - 1] = 0; } }
    if (Math.abs(pc) === KING) this.k[us] = m.f;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half; if (us < 0) this.full--;
  }
  legal() { const out = []; for (const m of this.gen()) { const u = this.make(m); if (!this.attacked(this.k[-this.side], this.side)) out.push(m); this.unmake(u); } return out; }
  insufficient() {
    const minors = []; for (let s = 0; s < 120; s++) { if (s & 0x88) { s += 7; continue; } const a = Math.abs(this.b[s]); if (!a || a === KING) continue; if (a === KNIGHT || a === BISHOP) minors.push(s); else return false; }
    if (minors.length <= 1) return true;
    if (minors.length === 2 && minors.every(s => Math.abs(this.b[s]) === BISHOP)) { const c = minors.map(s => (fileOf(s) + rankOf(s)) & 1); return c[0] === c[1]; }
    return false;
  }
}

// ---------------------------------------------------------------- evaluation (white's view, then signed)
const VAL = [0, 100, 320, 330, 500, 900, 0];
const T = (rows) => rows.trim().split(/\s+/).map(Number);   // tables written rank 8 → rank 1
const PST = [null,
  T(`0 0 0 0 0 0 0 0  50 50 50 50 50 50 50 50  10 10 20 30 30 20 10 10  5 5 10 25 25 10 5 5  0 0 0 20 20 0 0 0  5 -5 -10 0 0 -10 -5 5  5 10 10 -20 -20 10 10 5  0 0 0 0 0 0 0 0`),
  T(`-50 -40 -30 -30 -30 -30 -40 -50  -40 -20 0 0 0 0 -20 -40  -30 0 10 15 15 10 0 -30  -30 5 15 20 20 15 5 -30  -30 0 15 20 20 15 0 -30  -30 5 10 15 15 10 5 -30  -40 -20 0 5 5 0 -20 -40  -50 -40 -30 -30 -30 -30 -40 -50`),
  T(`-20 -10 -10 -10 -10 -10 -10 -20  -10 0 0 0 0 0 0 -10  -10 0 5 10 10 5 0 -10  -10 5 5 10 10 5 5 -10  -10 0 10 10 10 10 0 -10  -10 10 10 10 10 10 10 -10  -10 5 0 0 0 0 5 -10  -20 -10 -10 -10 -10 -10 -10 -20`),
  T(`0 0 0 0 0 0 0 0  5 10 10 10 10 10 10 5  -5 0 0 0 0 0 0 -5  -5 0 0 0 0 0 0 -5  -5 0 0 0 0 0 0 -5  -5 0 0 0 0 0 0 -5  -5 0 0 0 0 0 0 -5  0 0 0 5 5 0 0 0`),
  T(`-20 -10 -10 -5 -5 -10 -10 -20  -10 0 0 0 0 0 0 -10  -10 0 5 5 5 5 0 -10  -5 0 5 5 5 5 0 -5  0 0 5 5 5 5 0 -5  -10 5 5 5 5 5 0 -10  -10 0 5 0 0 0 0 -10  -20 -10 -10 -5 -5 -10 -10 -20`),
  T(`-30 -40 -40 -50 -50 -40 -40 -30  -30 -40 -40 -50 -50 -40 -40 -30  -30 -40 -40 -50 -50 -40 -40 -30  -30 -40 -40 -50 -50 -40 -40 -30  -20 -30 -30 -40 -40 -30 -30 -20  -10 -20 -20 -20 -20 -20 -20 -10  20 20 0 0 0 0 20 20  20 30 10 0 0 10 30 20`),
];
const KEND = T(`-50 -40 -30 -20 -20 -30 -40 -50  -30 -20 -10 0 0 -10 -20 -30  -30 -10 20 30 30 20 -10 -30  -30 -10 30 40 40 30 -10 -30  -30 -10 30 40 40 30 -10 -30  -30 -10 20 30 30 20 -10 -30  -30 -30 0 0 0 0 -30 -30  -50 -30 -30 -30 -30 -30 -30 -50`);
const cdist = (s) => Math.max(3 - Math.min(fileOf(s), 7 - fileOf(s)), 3 - Math.min(rankOf(s), 7 - rankOf(s)));
export function evaluate(pos) {
  const b = pos.b; let mat = [0, 0], score = 0, nonPawn = 0;
  for (let s = 0; s < 120; s++) {
    if (s & 0x88) { s += 7; continue; } const v = b[s]; if (!v) continue;
    const a = Math.abs(v); if (a !== PAWN && a !== KING) nonPawn += VAL[a];
    mat[v > 0 ? 0 : 1] += VAL[a];
  }
  const endgame = nonPawn <= 1300;
  for (let s = 0; s < 120; s++) {
    if (s & 0x88) { s += 7; continue; } const v = b[s]; if (!v) continue;
    const a = Math.abs(v), i = v > 0 ? (7 - rankOf(s)) * 8 + fileOf(s) : rankOf(s) * 8 + fileOf(s);
    const ps = a === KING && endgame ? KEND[i] : PST[a][i];
    score += (v > 0 ? 1 : -1) * (VAL[a] + ps);
  }
  // mop-up: with a clear material lead, drive the lone king to the edge and bring ours closer (helps finish the game)
  const diff = mat[0] - mat[1];
  if (endgame && Math.abs(diff) >= 300) {
    const win = diff > 0 ? 1 : -1, wk = pos.k[win], lk = pos.k[-win];
    const kd = Math.max(Math.abs(fileOf(wk) - fileOf(lk)), Math.abs(rankOf(wk) - rankOf(lk)));
    score += win * (cdist(lk) * 12 + (7 - kd) * 6);
  }
  return score * pos.side;
}

// ---------------------------------------------------------------- search
const MATE = 100000;
export function search(pos, { depth = 3, ms = 1000, noise = 0, rand = Math.random, blunder = 0, avoid = null } = {}) {
  const t0 = Date.now(); let nodes = 0, stop = false;
  const killers = [];
  const order = (ms_, ply, pv) => {
    const k = killers[ply] || [];
    for (const m of ms_) {
      const cap = pos.b[m.t];
      m.o = (pv && m.f === pv.f && m.t === pv.t && m.p === pv.p) ? 1e7 : cap ? 10000 + VAL[Math.abs(cap)] * 10 - VAL[Math.abs(pos.b[m.f])] / 10 : m.p ? 9000 : (k[0] && k[0].f === m.f && k[0].t === m.t) ? 8000 : (k[1] && k[1].f === m.f && k[1].t === m.t) ? 7000 : 0;
    }
    return ms_.sort((a, b) => b.o - a.o);
  };
  function qs(alpha, beta, ply) {
    nodes++;
    const stand = evaluate(pos); if (stand >= beta) return beta; if (stand > alpha) alpha = stand;
    if (ply > 24) return stand;
    for (const m of order(pos.gen(true), ply, null)) {
      const u = pos.make(m);
      if (pos.attacked(pos.k[-pos.side], pos.side)) { pos.unmake(u); continue; }
      const v = -qs(-beta, -alpha, ply + 1); pos.unmake(u);
      if (v >= beta) return beta; if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function ab(d, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() - t0 > ms) stop = true;
    if (stop) return 0;
    if (pos.half >= 100) return 0;
    const check = pos.inCheck();
    if (check) d++;
    if (d <= 0) return qs(alpha, beta, ply);
    let legal = 0, best = -MATE;
    for (const m of order(pos.gen(), ply, null)) {
      const u = pos.make(m);
      if (pos.attacked(pos.k[-pos.side], pos.side)) { pos.unmake(u); continue; }
      legal++;
      const v = -ab(d - 1, -beta, -alpha, ply + 1); pos.unmake(u);
      if (stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) { if (!pos.b[m.t]) { const k = killers[ply] || (killers[ply] = []); if (!k[0] || k[0].f !== m.f || k[0].t !== m.t) { k[1] = k[0]; k[0] = m; } } break; }
    }
    if (!legal) return check ? -MATE + ply : 0;
    return best;
  }
  const root = pos.legal(); if (!root.length) return null;
  if (blunder && rand() < blunder) return root[Math.floor(rand() * root.length)];
  const jitter = new Map(root.map(m => [m, noise ? (rand() * 2 - 1) * noise : 0]));
  const rep = (m) => { if (!avoid) return 0; const u = pos.make(m); const k = pos.key(); pos.unmake(u); return avoid.has(k) ? 40 * avoid.get(k) : 0; };
  const penalty = new Map(root.map(m => [m, rep(m)]));
  let bestMove = root[0], pv = null; const margin = noise ? noise * 2 + 20 : 0;
  for (let d = 1; d <= depth; d++) {
    let alpha = -MATE - 1, iterBest = null, iterScore = -MATE - 1;
    for (const m of order(root.slice(), 0, pv)) {
      const u = pos.make(m);
      let v = -ab(d - 1, -MATE - 1, -alpha + margin, 1);   // with noise, a wider window keeps near-equal moves' scores exact
      pos.unmake(u);
      if (stop) break;
      v += jitter.get(m) - penalty.get(m);
      if (v > iterScore) { iterScore = v; iterBest = m; }
      if (v > alpha) alpha = v;
    }
    if (stop && !iterBest) break;
    if (iterBest) { bestMove = iterBest; pv = iterBest; }
    if (stop || iterScore > MATE - 100) break;
    if (Date.now() - t0 > ms * 0.45) break;
  }
  return bestMove;
}

// CPU levels: Easy blunders now and then and sees one move ahead; Normal looks 2-3 plies; Hard searches deeper for longer.
export function think({ fen, diff, seed, fk = 1, avoid = [] }) {
  const pos = new Pos(fen), rand = mk(seed);
  const A = new Map(avoid);
  const L = [
    { depth: 1, ms: 300, noise: 160 / fk, blunder: 0.14 / fk },
    { depth: 3, ms: 600 * fk, noise: 22 / fk, blunder: 0 },
    { depth: 6, ms: 1500 * fk, noise: 0, blunder: 0 },
  ][diff] || { depth: 2, ms: 300 };
  const m = search(pos, { ...L, rand, avoid: A });
  return m && { f: m.f, t: m.t, p: m.p, fl: m.fl };
}
function mk(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

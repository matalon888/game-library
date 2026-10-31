// Splitstream v2 — 30 authored tracks in 3 worlds + a generator for the Daily Run and the levels after 30.
// Pure data + track maths (no DOM): game.js draws it, qa/levels.mjs proves every track can be skated.
// Tokens: T(len,g,c)  twin rails easing to gap g (c = rail centre, optional)   S(len)  single beam (squeeze)
//         D(len,b,w)  deck with a block b wide, window w to stay inside        Wv(len,g,amp,n)  rails that breathe n times
//         .ice  slippery (legs move slowly)   .boost  speed pad
const mk = (o) => Object.assign(Object.create(null), o);
export const T = (len, g, c) => mk({ k: 'T', len, g, c });
export const S = (len, c) => mk({ k: 'S', len, c });
export const D = (len, b, w = 2.4) => mk({ k: 'D', len, b, w });
export const Wv = (len, g, amp, n = 3, c) => mk({ k: 'W', len, g, amp, n, c });
export const ice = (t) => Object.assign(t, { ice: 1 });
export const boost = (t) => Object.assign(t, { boost: 1 });
export const WORLDS = [
  { name: 'Sunset Strip', from: 1, to: 10, sky: 0 },
  { name: 'Neon Pier', from: 11, to: 20, sky: 1 },
  { name: 'Glass Sky', from: 21, to: 30, sky: 2 },
];
const L = (w, name, why, sp, seg, o = {}) => ({ w, name, why, sp, seg, ...o });
export const LEVELS = [
  // ---------------- World 1: rails, beams, decks
  L(0, 'First Steps', 'cannot fail: gentle rails, the legs learn to breathe', 12, [T(40, 2.4), T(40, 1.8), T(40, 3.0), T(40, 2.0), T(40, 2.8), T(40, 2.2), T(40, 2.6)]),
  L(0, 'In and Out', 'bigger swings, still wide rails', 12.5, [T(30, 3.6), T(30, 1.6), T(30, 4.0), T(30, 1.8), T(30, 3.8), T(30, 1.6), T(30, 3.2), T(30, 2.2)]),
  L(0, 'Slalom', 'the track bends: first level that can be lost', 12.8, [T(26, 2.4, -1.8), T(26, 3.2, 1.8), T(26, 2.0, -2), T(26, 3.6, 2), T(26, 2.2, -1.5), T(26, 3.2, 1.5), T(26, 2.6, 0), T(26, 3.4, -2), T(26, 2.0, 1)]),
  L(0, 'Squeeze', 'new: single beam. Pull the legs together once', 13, [T(30, 3.0), T(22, 3.0), S(14), T(24, 3.0), T(30, 2.4), T(26, 3.4), T(26, 2.2), T(22, 3.0), T(22, 3.0)]),
  L(0, 'Beam Walk', 'beams between wide rails: breathe in, breathe out', 13.2, [T(30, 3.0), S(10), T(30, 3.0), S(10), T(30, 3.0), S(10), T(30, 3.2), S(12), T(30, 2.8), T(24, 3.0)]),
  L(0, 'Straddle', 'new: a deck with a block. Legs wide around it', 13.4, [T(26, 2.6), T(16, 2.6), D(24, 2.0, 3.0), T(30, 2.8), T(30, 2.2), T(30, 3.4), T(30, 2.4), T(26, 3.0)]),
  L(0, 'Deck Hop', 'two decks, different blocks', 13.6, [T(24, 3.0), D(22, 1.6, 3.0), T(24, 2.4), T(26, 3.6), D(24, 3.0, 2.8), T(26, 2.6), T(26, 3.2), T(24, 2.2)]),
  L(0, 'Pinch and Wide', 'beam, then straight into a deck: the legs travel far', 14, [T(26, 3.0), S(12), T(16, 3.6), D(22, 2.6, 2.6), T(18, 3.0), S(12), T(14, 3.2), D(22, 3.2, 2.4), T(24, 2.6), S(10), T(26, 3.0)]),
  L(0, 'Quick Change', 'the rails change fast: read ahead on the meter', 12.5, [T(24, 3.0), T(16, 1.6), T(16, 4.2), T(16, 1.8), T(16, 4.0), T(18, 2.0), T(18, 3.6), T(16, 1.6), T(16, 4.2), S(10), T(20, 3.0), T(22, 2.2), T(26, 3.4)]),
  L(0, 'Sunset Run', 'BOSS: everything from world 1, no breaks', 14.5, [T(24, 3.0), S(12), T(14, 3.6), D(20, 2.2, 2.6), T(14, 2.0, -1.5), T(12, 4.0, 1.5), T(12, 1.4, -1), S(10, 0), T(14, 3.4), D(20, 3.0, 2.2), T(12, 1.4), T(12, 4.2), T(12, 1.4), S(12), T(14, 3.8), D(24, 1.6, 2.2), T(22, 2.6), S(10), T(26, 3.2)], { hard: 1 }),
  // ---------------- World 2: breathing rails, boost pads, snap gates
  L(1, 'Breathing Rails', 'new: rails that breathe. Ride the rhythm', 14.5, [T(24, 3.0), Wv(50, 3.0, 0.8, 3), T(16, 3.0), Wv(50, 3.2, 1.0, 4), T(30, 2.6), Wv(40, 3.0, 1.0, 3), T(30, 3.0)]),
  L(1, 'Deep Breath', 'wider breathing, with a beam to rest in', 14.8, [T(20, 3.2), Wv(46, 3.4, 1.4, 3), S(12), T(14, 3.2), Wv(56, 3.4, 1.5, 4), S(12), T(14, 3.0), Wv(50, 3.4, 1.6, 4), T(30, 3.0)]),
  L(1, 'Breath and Beam', 'breathing rails that end in a pinch', 15, [T(20, 3.0), Wv(40, 3.2, 1.2, 3), S(10), T(14, 3.4), Wv(40, 3.0, 1.4, 3), S(10), T(14, 3.4), D(22, 2.2, 2.6), Wv(44, 3.2, 1.3, 3), S(10), T(30, 3.0)]),
  boostL(),
  L(1, 'Express Deck', 'a boost pad runs you into decks', 15.2, [T(24, 3.0), boost(T(36, 3.0)), D(22, 2.2, 2.8), T(20, 2.6), boost(T(30, 2.4)), D(22, 3.0, 2.6), T(20, 3.0), boost(T(30, 3.4)), D(20, 1.8, 2.4), T(24, 2.6), S(10), T(30, 3.0)]),
  L(1, 'Snap Gates', 'new: gates that snap shut then fly open', 15.4, [T(24, 3.6), T(7, 0.9), T(14, 0.9), T(7, 4.2), T(18, 4.2), T(7, 1.0), T(14, 1.0), T(7, 4.4), T(16, 4.4), T(8, 1.0), T(10, 1.0), T(8, 4.4), T(14, 4.4), T(7, 1.0), T(10, 1.0), T(7, 3.4), T(26, 3.0)]),
  L(1, 'Snake Pier', 'breathing rails that also bend', 15.6, [T(20, 3.0, 0), Wv(46, 3.2, 1.0, 3, -2), Wv(46, 3.2, 1.0, 3, 2), Wv(46, 3.4, 1.2, 4, -2.2), S(10, 0), T(14, 3.0), Wv(46, 3.4, 1.2, 4, 2.2), T(30, 3.0, 0)]),
  L(1, 'Rocket Beam', 'boost into beams: pinch before you see it', 15.8, [T(24, 3.2), boost(T(28, 3.2)), S(9), T(10, 3.6), boost(T(24, 3.4)), S(9), T(10, 3.6), boost(T(26, 3.2)), S(9), T(12, 3.2), D(20, 2.6, 2.4), boost(T(26, 3.0)), S(9), T(30, 3.0)]),
  L(1, 'Pier Party', 'breather: wide and sweet, a trail of gems', 15, [T(24, 3.0), boost(Wv(60, 3.4, 1.0, 4)), T(20, 3.0), boost(Wv(60, 3.6, 1.2, 4)), T(20, 3.0), boost(Wv(60, 3.4, 1.0, 5)), T(30, 3.0)], { gem: 1.6 }),
  L(1, 'Neon Pier', 'BOSS: breathing, snaps, boost and decks', 16.2, [T(22, 3.0), Wv(40, 3.2, 1.2, 3), S(9), T(8, 3.6), T(7, 0.9), T(10, 0.9), T(7, 4.2), boost(T(24, 4.2)), D(20, 2.0, 2.4), Wv(40, 3.4, 1.4, 4), T(7, 1.0), T(10, 1.0), T(7, 4.4), S(9), T(10, 3.4), boost(Wv(40, 3.4, 1.2, 3)), D(22, 3.0, 2.2), T(7, 1.0), T(9, 1.0), T(7, 3.8), Wv(36, 3.4, 1.3, 3), S(10), T(30, 3.0)], { hard: 1 }),
  // ---------------- World 3: ice, tight decks, gauntlets
  L(2, 'First Ice', 'new: ice. The legs slide: move early', 15.4, [T(24, 3.0), ice(T(30, 3.0)), ice(T(30, 2.2)), ice(T(30, 3.4)), T(20, 3.0), ice(T(34, 2.0)), ice(T(34, 3.6)), ice(T(30, 2.6)), T(30, 3.0)]),
  L(2, 'Ice Beams', 'ice into beams: pinch in advance', 15.8, [T(22, 3.2), ice(T(30, 3.2)), ice(S(14)), ice(T(26, 3.4)), ice(S(14)), T(14, 3.0), ice(T(30, 3.2)), ice(S(16)), ice(T(30, 3.0)), T(24, 3.0)]),
  L(2, 'Ice Deck', 'ice with decks: widen early', 16, [T(22, 3.0), ice(T(26, 2.8)), ice(D(24, 2.2, 3.0)), ice(T(26, 2.4)), ice(D(24, 3.0, 2.6)), T(16, 3.0), ice(T(24, 3.0)), ice(D(24, 1.6, 2.6)), ice(T(30, 2.6)), T(24, 3.0)]),
  L(2, 'Slippery Waves', 'breathing rails on ice: ride the rhythm early', 16.2, [T(20, 3.0), ice(Wv(54, 3.2, 1.0, 3)), T(12, 3.0), ice(Wv(54, 3.4, 1.2, 3)), ice(S(12)), ice(T(18, 3.4)), ice(Wv(54, 3.4, 1.3, 3)), T(30, 3.0)]),
  L(2, 'Glass Slide', 'breather: boosted ice, wide and flashy', 16, [T(22, 3.4), boost(ice(T(46, 3.6))), boost(ice(Wv(60, 3.6, 0.8, 3))), T(16, 3.2), boost(ice(T(46, 3.4))), boost(ice(Wv(60, 3.6, 1.0, 4))), T(30, 3.2)], { gem: 1.6 }),
  L(2, 'Tight Decks', 'new: the safe window on decks gets small', 16.4, [T(22, 3.0), D(20, 1.6, 1.8), T(20, 3.0), D(20, 3.2, 1.8), T(14, 3.0), D(20, 2.0, 1.6), T(16, 3.4), D(20, 3.6, 1.6), T(14, 2.6), S(10), T(14, 3.4), D(22, 2.6, 1.6), T(26, 3.0)]),
  L(2, 'Snap on Ice', 'snap gates, but the floor is ice', 16.6, [T(22, 3.6), ice(T(8, 1.0)), ice(T(16, 1.0)), ice(T(10, 4.2)), ice(T(20, 4.2)), ice(T(8, 1.0)), ice(T(14, 1.0)), ice(T(10, 4.2)), ice(T(18, 4.2)), ice(T(9, 1.0)), ice(T(12, 1.0)), ice(T(9, 3.4)), T(28, 3.0)]),
  L(2, 'Gauntlet', 'a bit of everything, one after the other', 17, [T(20, 3.0), boost(D(22, 2.2, 2.0)), Wv(40, 3.2, 1.2, 3), S(9), T(8, 3.6), ice(T(8, 1.0)), ice(T(14, 1.0)), ice(T(10, 4.2)), boost(T(18, 4.2)), D(20, 3.0, 1.8), ice(Wv(46, 3.4, 1.2, 3)), ice(S(11)), ice(T(18, 3.4)), D(20, 1.8, 1.8), T(7, 1.0), T(10, 1.0), T(7, 3.8), T(26, 3.0)], { hard: 1 }),
  L(2, 'Last Approach', 'deck chain at speed, then the clear sky', 17.2, [T(22, 3.0), boost(T(24, 3.0)), D(18, 2.0, 1.8), T(12, 3.0), D(18, 3.4, 1.8), T(12, 2.4), D(18, 1.6, 1.6), boost(T(18, 3.2)), S(9), T(12, 3.6), D(20, 2.8, 1.6), ice(Wv(44, 3.4, 1.2, 3)), T(28, 3.0)]),
  L(2, 'Glass Sky', 'BOSS: the whole city on one run', 17.6, [T(22, 3.0), Wv(36, 3.2, 1.3, 3), ice(S(10)), ice(T(14, 3.6)), D(20, 2.2, 1.8), boost(T(20, 3.2)), T(7, 0.9), T(10, 0.9), T(7, 4.4), ice(Wv(44, 3.4, 1.4, 4)), ice(S(10)), T(10, 3.6), boost(D(22, 3.2, 1.7)), ice(T(8, 1.0)), ice(T(12, 1.0)), ice(T(10, 4.4)), D(20, 1.8, 1.7), Wv(36, 3.4, 1.4, 3), S(9), T(8, 3.6), boost(ice(Wv(44, 3.4, 1.3, 4))), D(22, 2.6, 1.6), T(7, 1.0), T(9, 1.0), T(7, 3.8), T(30, 3.0)], { hard: 1 }),
];
function boostL() { return L(1, 'Boost Pad', 'new: boost pads. The world speeds up: nothing else changes', 15, [T(24, 3.0), boost(T(34, 3.0)), T(22, 2.6), T(24, 3.4), boost(T(34, 3.0)), T(22, 2.4), boost(T(30, 3.4)), T(24, 2.8), boost(T(34, 3.0)), T(30, 3.0)]); }

// ---------------- generator (Daily Run + levels after 30): builds from the same vocabulary, seeded
export function generate(seed, diff = 20) {
  let a = seed >>> 0; const R = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const hard = Math.min(1, (diff - 8) / 24), seg = [T(22, 3.0)];
  let n = 0, c = 0;
  while (n < 14) {
    n++; const r = R(), ic = R() < 0.25 * hard + (diff > 20 ? 0.1 : 0), bo = R() < 0.18;
    const wrap = (t) => (ic && diff > 18 ? ice(t) : t);
    let t;
    if (r < 0.25) t = [T(14 + R() * 10, 1.2 + R() * 3.2), T(12 + R() * 8, 2 + R() * 2)];
    else if (r < 0.42) t = [T(12, 3.2), S(9 + R() * 4), T(12, 3.4)];
    else if (r < 0.62) t = [D(18 + R() * 6, 1.6 + R() * 2, 2.8 - hard * 1.2), T(14, 3.0)];
    else if (r < 0.78) t = [Wv(36 + R() * 14, 3.1 + R() * 0.4, 0.9 + hard * 0.7 + R() * 0.3, 3 + Math.floor(R() * 2))];
    else if (r < 0.9) t = [T(7, 1.0), T(10, 1.0), T(7, 3.8 + R() * 0.6), T(12, 3.4)];
    else t = [T(14, 3.0, pick([-2, 0, 2])), T(14, 2.6, pick([-2, 2]))];
    t = t.map(x => (x.k === 'T' || x.k === 'W') && !x.c ? x : x);
    if (bo && t[0].k === 'T') boost(t[0]); t = t.map(wrap); seg.push(...t);
  }
  seg.push(T(26, 3.0));
  return L(Math.min(2, Math.floor(diff / 10)), 'Daily Run', 'a fresh mix, same for everyone today', 13 + Math.min(5, diff * 0.17), seg);
}
export function levelAt(n) { return n <= LEVELS.length ? LEVELS[n - 1] : { ...generate(n * 977 + 13, n), name: 'Beyond ' + n, w: 2 }; }

// ---------------- track maths (shared by the game and the solver)
const sm = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
export const RW = 0.95;
export function buildSegs(lv) {
  const segs = []; let z = 8, c = 0, g = 1.6;
  const push = (type, len, g1, c1, extra = {}) => { segs.push({ type, z0: z, z1: z - len, g0: g, g1, c0: c, c1, ...extra }); z -= len; g = g1; c = c1; };
  push('twin', 22, 1.6, 0);
  for (const t of lv.seg) {
    const LS = t.len > 12 ? 1.4 : 1, c1 = t.c === undefined ? c : t.c, fl = { ice: t.ice, boost: t.boost };
    if (t.k === 'T') push('twin', t.len * LS, t.g, c1, fl);
    else if (t.k === 'S') { if (g > 0.3) push('twin', 8, 0, c1, fl); push('single', t.len * LS, 0, c1, fl); }
    else if (t.k === 'W') push('twin', t.len * LS, t.g, c1, { ...fl, amp: t.amp, n: t.n });
    else if (t.k === 'D') { const gd = t.b + t.w / 2 + 0.08; if (Math.abs(g - gd) > 0.2 || c !== c1) push('twin', 7, gd, c1, fl); push('deck', t.len * LS, gd, c1, { ...fl, b: t.b, W: t.b + t.w }); }
  }
  push('twin', 10, 1.6, c); const endZ = z; push('twin', 30, 1.6, c);
  return { segs, endZ };
}
export function at(segs, z) {
  for (const s of segs) if (z <= s.z0 && z >= s.z1) {
    const t = sm((s.z0 - z) / (s.z0 - s.z1)); let g = lerp(s.g0, s.g1, t);
    if (s.amp) g += s.amp * Math.sin((s.z0 - z) / (s.z0 - s.z1) * s.n * Math.PI * 2) * Math.sin(Math.min(1, (s.z0 - z) / 8) * Math.PI / 2);
    return { c: lerp(s.c0, s.c1, t), g, type: s.type, s };
  }
  const s = z > segs[0].z0 ? segs[0] : segs[segs.length - 1]; return { c: z > s.z0 ? s.c0 : s.c1, g: z > s.z0 ? s.g0 : s.g1, type: s.type, s };
}
export function ok(A, s) { return A.type === 'deck' ? (s > A.s.b + 0.2 && s < A.s.W - 0.05) : Math.abs(s - A.g) < RW + 0.12; }
export const need = (A) => (A.type === 'deck' ? A.s.b + (A.s.W - A.s.b) / 2 : Math.max(0.4, A.g));

// gen.js — seeded level generator + solver for Grumble Drop. Pure logic (no DOM) so it also runs in node for testing.
// A level is islands over the sea, bridges and little block towers, grumpy trolls and one friend (Pip).
// Every level is checked by simulation: there is a sequence of taps (block removals) that drops all trolls in the sea
// while Pip stays dry, within the tap budget.
import { world, body } from './phys.js';

export const DT = 1 / 120, WATER = -1.7;
export const MAT = {
  wood: { tap: true, density: 0.55, friction: 0.7 },
  glass: { tap: true, density: 0.45, friction: 0.35 },
  stone: { tap: false, density: 1.4, friction: 0.8 },
};
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/** level description: plain data (rebuilt into bodies for play and for the solver check).
 *  Motifs: BRIDGE over a gap (a troll on it, maybe on a cube), RAMP at an outer edge (a troll rests against a stopper),
 *  and TOWERS on the islands (decoys and safe spots for Pip). `plan` = the designed taps that drop every troll. */
export function describe(seed, lvl, fk = 1) {
  const r = rngf(seed * 7919 + 13);
  const nIs = lvl <= 2 ? 2 : r() < 0.5 ? 3 : 2;
  const span = 6.0, gaps = Array.from({ length: nIs - 1 }, () => 1.0 + r() * 0.3);
  const free = span - gaps.reduce((x, y) => x + y, 0);
  let ws = Array.from({ length: nIs }, () => 0.7 + r()); const sw = ws.reduce((x, y) => x + y, 0); ws = ws.map(w => w / sw * free);
  const islands = []; let x = -span / 2;
  ws.forEach((w, i) => { islands.push({ x0: x, x1: x + w }); x += w + (gaps[i] || 0); });
  const blocks = [], chars = [], plan = [];
  const add = (o) => { blocks.push(o); return blocks.length - 1; };
  const tapM = () => (r() < 0.6 ? 'wood' : 'glass'), anyM = () => { const v = r(); return v < 0.5 ? 'wood' : v < 0.75 ? 'glass' : 'stone'; };
  // ---- motif slots
  const slots = [];
  for (let i = 0; i < nIs - 1; i++) slots.push({ type: 'bridge', a: islands[i].x1, b: islands[i + 1].x0 });
  const L0 = islands[0], L1 = islands[nIs - 1];
  for (const [is, xe, sg] of [[L0, L0.x0, -1], [L1, L1.x1, 1]]) {
    const w = is.x1 - is.x0;
    if (w > 2.25 && r() < 0.55) slots.push({ type: 'ramp', xe, s: sg, is });
    else if (w > 1.75) slots.push({ type: 'lever', xe, s: sg, is });
  }
  // trolls on some slots, Pip on another one or on an island tower
  const want = Math.max(1, Math.min(slots.length, Math.round((lvl <= 1 ? 1 : lvl <= 4 ? 2 : lvl <= 9 ? 2 + (r() < 0.5 ? 1 : 0) : 3) * fk)));
  const order = slots.map((sl, i) => ({ i, k: r() })).sort((p, q) => p.k - q.k).map(o => o.i);
  const trollSlots = new Set(order.slice(0, want));
  let pipSlot = -1;
  if (lvl >= 3 && order.length > want && r() < 0.6) pipSlot = order[want];
  const used = [];                                       // x ranges on islands taken by ramps
  slots.forEach((sl, i) => {
    const who = trollSlots.has(i) ? 'troll' : i === pipSlot ? 'pip' : null;
    if (sl.type === 'bridge') {
      const g = sl.b - sl.a, cx = (sl.a + sl.b) / 2, high = lvl >= 2 && r() < 0.65;
      let base = 0;
      if (high) {                                         // raised bridge on two posts
        const hp = 0.6 + r() * (lvl >= 5 ? 0.8 : 0.5);
        add({ x: sl.a - 0.25, y: hp / 2, w: 0.3, h: hp, m: anyM() }); add({ x: sl.b + 0.25, y: hp / 2, w: 0.3, h: hp, m: anyM() });
        base = hp;
      }
      const len = g + (high ? 0.95 : 1.1);
      const bi = add({ x: cx, y: base + 0.15, w: len, h: 0.3, m: who === 'pip' ? (r() < 0.5 ? 'wood' : 'glass') : who ? tapM() : anyM() });
      if (who === 'troll') plan.push(bi);
      let top = base + 0.3, cxx = cx + (r() - 0.5) * g * 0.3;
      const nst = who ? (lvl <= 1 ? (r() < 0.5 ? 0 : 1) : r() < 0.25 ? 0 : r() < 0.55 ? 1 : 2 + (lvl >= 6 && r() < 0.4 ? 1 : 0)) : 0;
      for (let k = 0; k < nst; k++) { const s = 0.5 + r() * 0.1; add({ x: cxx, y: top + s / 2, w: s, h: s, m: who === 'pip' ? 'stone' : anyM() }); top += s; }
      if (who) chars.push({ kind: who, x: cxx, y: top + 0.36, r: who === 'pip' ? 0.3 : 0.34 });
    } else if (sl.type === 'lever') {
      // lever: a plank over the edge, a troll on the overhang, a counterweight on the inner end
      const s = sl.s, xe = sl.xe, xc = xe - s * 0.1;
      add({ x: xc, y: 0.1, w: 2.1, h: 0.2, m: r() < 0.6 ? 'stone' : tapM() });
      const ncw = lvl >= 3 && r() < 0.6 ? 2 : 1; let cy = 0.2;
      for (let k = 0; k < ncw; k++) { const sz = k ? 0.48 : 0.58, cw = add({ x: xe - s * 0.88, y: cy + sz / 2, w: sz, h: sz, m: who === 'pip' ? 'stone' : who ? tapM() : anyM() }); cy += sz; if (who === 'troll') plan.unshift(cw); }
      used.push([Math.min(xe, xe - s * 1.35), Math.max(xe, xe - s * 1.35)]);
      if (who) chars.push({ kind: who, x: xe + s * 0.55, y: 0.2 + 0.36, r: who === 'pip' ? 0.3 : 0.34 });
    } else {
      // ramp: prop (inside) -> plank sloping down to the edge -> stopper at the very edge
      const s = sl.s, xe = sl.xe, hp = 0.62 + r() * 0.3, run = 1.3 + r() * 0.2;
      const xs = xe - s * 0.25, xl = xe - s * 0.66, xu = xl - s * run;
      const stop = add({ x: xs, y: 0.27, w: 0.42, h: 0.54, m: who === 'pip' ? 'stone' : who ? tapM() : anyM() });
      if (who === 'troll') plan.push(stop);
      add({ x: xu - s * 0.12, y: hp / 2, w: 0.5, h: hp, m: anyM() });
      const ang = Math.atan2(-hp, (xl - xu)), len = Math.hypot(xl - xu, hp) + 0.04, nx = -Math.sin(ang), ny = Math.cos(ang);
      const nn = ny < 0 ? -1 : 1, mx = (xl + xu) / 2 + nx * nn * 0.13, my = hp / 2 + ny * nn * 0.13;
      add({ x: mx, y: my, w: len, h: 0.2, m: r() < 0.5 ? 'wood' : 'stone', rot: ang });
      used.push([Math.min(xu, xe) - 0.4, Math.max(xu, xe) + 0.4]);
      if (who) { const t = 0.62; chars.push({ kind: who, x: xu + (xl - xu) * t + nx * nn * (0.5), y: hp * (1 - t) + ny * nn * 0.5, r: who === 'pip' ? 0.3 : 0.34 }); }
    }
  });
  // ---- towers on the islands (decoys; Pip's home when not on a motif)
  const tops = [];
  for (const is of islands) {
    const w = is.x1 - is.x0, n = Math.max(1, Math.floor(w / 1.15));
    for (let k = 0; k < n; k++) {
      const cx = is.x0 + (k + 0.5) * w / n;
      if (cx - is.x0 < 0.75 || is.x1 - cx < 0.75) continue;            // keep bridge landings free
      if (used.some(([p, q]) => cx > p && cx < q)) continue;
      tops.push({ x: cx, w: Math.min(1.05, w / n * 0.85) });
    }
  }
  const pipTower = pipSlot < 0 ? Math.floor(r() * tops.length) : -1;
  tops.forEach((t, i) => {
    let y = 0; const kind = r();
    if (kind < 0.2) { const s = 0.6 + r() * 0.15; add({ x: t.x, y: y + s / 2, w: s, h: s, m: anyM() }); y += s; }
    else if (kind < 0.55) { const nk = r() < 0.5 ? 3 : 2; for (let k = 0; k < nk; k++) { const s = 0.55 + r() * 0.1; add({ x: t.x, y: y + s / 2, w: s, h: s, m: anyM() }); y += s; } }
    else if (kind < 0.85 && t.w > 0.85) { const ph = 0.6 + r() * 0.4, sp = t.w / 2;
      add({ x: t.x - sp + 0.13, y: ph / 2, w: 0.26, h: ph, m: anyM() }); add({ x: t.x + sp - 0.13, y: ph / 2, w: 0.26, h: ph, m: anyM() });
      y = ph; add({ x: t.x, y: y + 0.12, w: sp * 2 + 0.2, h: 0.24, m: anyM() }); y += 0.24;
      if (r() < 0.6) { const s = 0.5; add({ x: t.x, y: y + s / 2, w: s, h: s, m: anyM() }); y += s; } }
    else { const ph = 0.8 + r() * 0.5; add({ x: t.x, y: ph / 2, w: 0.4, h: ph, m: anyM() }); y = ph; }
    if (i === pipTower) chars.push({ kind: 'pip', x: t.x, y: y + 0.32, r: 0.3 });
  });
  if (!chars.some(c => c.kind === 'pip')) { const is = islands[0]; chars.push({ kind: 'pip', x: (is.x0 + is.x1) / 2 + 0.3, y: 0.32, r: 0.3 }); }
  return { seed, lvl, islands, blocks, chars, plan };
}

/** bodies for a description */
export function build(L) {
  const W = world({ gravity: -15, iters: 10 });
  for (const is of L.islands) W.add(body({ x: (is.x0 + is.x1) / 2, y: -2, w: is.x1 - is.x0, h: 4, fixed: true, friction: 0.9, kind: 'island' }));
  L.blocks.forEach((b, i) => W.add(body({ x: b.x, y: b.y, rot: b.rot || 0, w: b.w, h: b.h, mass: b.w * b.h * MAT[b.m].density, friction: MAT[b.m].friction, kind: 'block', m: b.m, tap: MAT[b.m].tap, bi: i })));
  L.chars.forEach((c, i) => W.add(body({ x: c.x, y: c.y, r: c.r, mass: c.r * c.r * 1.3, friction: 0.8, kind: c.kind, ci: i })));
  return W;
}
export const chars = (W) => W.bodies.filter(b => b.kind === 'troll' || b.kind === 'pip');
export const tappable = (W) => W.bodies.filter(b => b.tap);

/** run until everything is still (or maxS seconds), drowning characters that reach the sea */
export function settle(W, maxS = 3.5, onDrown) {
  let calm = 0;
  for (let i = 0; i < maxS / DT; i++) {
    W.step(DT);
    for (const b of [...W.bodies]) if (!b.fixed && b.y < WATER - 0.4) { W.remove(b); onDrown && onDrown(b); }
    if (W.energy() < 0.04) { if (++calm > 24) return true; } else calm = 0;
  }
  return false;
}
const status = (W) => { const c = chars(W); return { trolls: c.filter(b => b.kind === 'troll').length, pip: c.some(b => b.kind === 'pip') }; };

/** snapshot / restore of the moving bodies (lets the solver branch without re-simulating from the start) */
const snap = (W) => W.bodies.filter(b => !b.fixed).map(b => [b.kind, b.bi, b.ci, b.x, b.y, b.rot, b.vx, b.vy, b.w]);
function fromSnap(L, S) {
  const W = build(L), keep = new Set();
  for (const s of S) { const b = W.bodies.find(o => o.kind === s[0] && o.bi === s[1] && o.ci === s[2]); if (!b) continue; keep.add(b); [b.x, b.y, b.rot, b.vx, b.vy, b.w] = s.slice(3); }
  for (const b of [...W.bodies]) if (!b.fixed && !keep.has(b)) W.remove(b);
  return W;
}
/** beam search for a solution: shortest tap sequence that drowns every troll and keeps Pip */
export function solve(L, maxDepth = 3, beam = 3) {
  const W0 = build(L); settle(W0, 2.5);
  const s0 = status(W0); if (!s0.pip || s0.trolls === 0 || s0.trolls < L.chars.length - 1) return null;
  let layer = [{ seq: [], S: snap(W0) }], traps = 0, sims = 0;
  for (let d = 1; d <= maxDepth; d++) {
    const next = [];
    for (const n of layer) {
      const cand = n.S.filter(s => s[0] === 'block' && MAT[L.blocks[s[1]].m].tap).map(s => s[1]);
      for (const bi of cand) {
        const W = fromSnap(L, n.S); W.remove(W.bodies.find(o => o.bi === bi)); settle(W, 3); sims++;
        const s = status(W);
        if (!s.pip) { if (d === 1) traps++; continue; }
        if (s.trolls === 0) return { seq: [...n.seq, bi], traps, sims };
        next.push({ seq: [...n.seq, bi], S: snap(W), score: (s0.trolls - s.trolls) * 10 - d });
      }
    }
    next.sort((a, b) => b.score - a.score);
    layer = next.slice(0, beam);
    if (!layer.length) break;
  }
  return null;
}

/** a playable level: the designed plan must work in simulation (and nothing may fall before the first tap) */
export function makeLevel(seed, lvl, fk = 1) {
  for (let t = 0; t < 40; t++) {
    const L = describe(seed + t * 101, lvl, fk);
    const W = build(L); settle(W, 2.5);
    const s0 = status(W); if (!s0.pip || s0.trolls < L.chars.length - 1) continue;
    // nothing may topple before the first tap
    let ok = L.blocks.every((d, i) => { const b = W.bodies.find(o => o.bi === i); return b && Math.hypot(b.x - d.x, b.y - d.y) < 0.12 && Math.abs(b.rot - (d.rot || 0)) < 0.12; });
    if (!ok) continue;
    for (const bi of L.plan) { const b = W.bodies.find(o => o.bi === bi); if (!b) { ok = false; break; } W.remove(b); settle(W, 3); if (!status(W).pip) { ok = false; break; } }
    if (!ok || status(W).trolls) continue;
    const extra = Math.max(0, Math.min(3, Math.round((lvl <= 2 ? 2 : lvl <= 5 ? 1.4 : 0.9) / fk)));
    return { ...L, sol: L.plan, taps: L.plan.length + extra, tries: t };
  }
  return null;
}

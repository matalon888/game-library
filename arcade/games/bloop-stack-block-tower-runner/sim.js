// Bloop Stack v2 — the pure rules (no drawing). deep.js plays them live; qa/solve.mjs searches them to prove every level can be
// cleared, to find how many gems and flush ("perfect") walls are possible together, and to set the star bar.
// One step = one frame at 60 fps. Same physics as v1 (walls scrape the lowest blocks, a roof crushes a tall stack) plus gems,
// bonus blocks, spring pads and crushing roofs. Nothing here depends on the device or on flow.k(): a level is the same for everyone.

export const GRAV = 0.022, SPRING_VY = 0.36, FEVER_FRAMES = 300;

// ---- level text -> columns. A level is one string of segments after a 9-column runway at height 1:
//   "<rise>/<width>" with rise +k (wall), -k (drop), = (flat) or an absolute height, then flags, all relative to the segment's ground:
//   r<k> roof k cells above the ground   g<a>,<b> gems a, b cells above it   p<k> bonus block k above it
//   s spring pad on the first column   c<lo>-<hi> crushing roof moving between lo and hi above   k checkpoint flag
export function parse(text, { runway = 9, tail = 16 } = {}) {
  const G = [], C = [], CR = [], items = [], springs = [], checks = [];
  const put = (h, w, c = Infinity, cr = null) => { for (let i = 0; i < w; i++) { G.push(h); C.push(c); CR.push(cr); } };
  put(1, runway);
  let h = 1;
  for (const tok of text.trim().split(/\s+/)) {
    const m = /^([+\-]\d+|=|\d+)\/(\d+)(.*)$/.exec(tok); if (!m) throw new Error('bad token ' + tok);
    h = m[1] === '=' ? h : /^[+\-]/.test(m[1]) ? h + +m[1] : +m[1];
    if (h < 0 || h > 10) throw new Error('height ' + h + ' at ' + tok);
    const w = +m[2], flags = m[3].match(/[a-z][\d,.\-]*/g) || [];
    let roof = Infinity, cr = null, gems = [], plus = null, spring = false, check = false;
    for (const f of flags) {
      const k = f[0], v = f.slice(1);
      if (k === 'r') roof = h + +v; else if (k === 'g') gems = v.split(',').map(y => h + +y); else if (k === 'p') plus = h + +v;
      else if (k === 's') spring = true; else if (k === 'k') check = true;
      else if (k === 'c') { const [lo, hi] = v.split('-').map(Number); cr = { lo: h + lo, hi: h + hi, per: 2.6 + ((G.length * 7) % 5) * 0.2, ph: (G.length * 1.3) % 6.28 }; roof = h + lo; }
    }
    const x0 = G.length;
    put(h, w, roof, cr);
    gems.forEach((y, i) => items.push({ kind: 'gem', x: x0 + (w * (i + 1)) / (gems.length + 1), y }));
    if (plus != null) items.push({ kind: 'plus', x: x0 + w / 2, y: plus });
    if (spring) springs.push(x0);
    if (check) checks.push(x0);
  }
  const finishX = G.length + 2; put(h, tail);
  items.sort((a, b) => a.x - b.x); items.forEach((it, i) => it.i = i);
  return { G, C, CR, items, springs, checks, finishX, gemTotal: items.filter(i => i.kind === 'gem').length };
}

export const gAt = (T, px) => { const i = Math.floor(px); return i < 0 ? T.G[0] : i >= T.G.length ? T.G[T.G.length - 1] : T.G[i]; };
export function cAt(T, px, f) {
  const i = Math.floor(px); if (i < 0 || i >= T.C.length) return Infinity;
  const c = T.CR[i]; if (!c) return T.C[i];
  return c.lo + (c.hi - c.lo) * (0.5 + 0.5 * Math.sin((f / 60) * 6.283 / c.per + c.ph));
}

// ---- state
export function start(T, speed, from = null) {
  const x = from ? from.x : 1.5, base = from ? from.base : T.G[1];
  return { T, v: speed / 60, x, base, n: 0, vy: 0, f: 0, streak: 0, perfects: 0, walls: 0, gemsGot: 0, got: from ? from.got.slice() : new Array(T.items.length).fill(false), taps: 0,
    status: 'play', ev: [], fever: 0, bonus: 0, lastTap: -99, why: '', short: 0 };
}
export function clone(s) { return { ...s, got: s.got.slice(), ev: [] }; }
export const top = (s) => s.base + s.n;

export function tap(s) {
  if (s.status !== 'play') return false;
  s.n++; s.taps++; s.lastTap = s.f; s.ev.push({ t: 'tap', n: s.n }); return true;
}

// one frame. assist: level 1 helper, adds the block the next wall needs (never used by the solver).
export function step(s, assist = false) {
  if (s.status !== 'play') return s;
  const T = s.T; s.ev.length = 0; s.f++;
  if (s.fever > 0) s.fever--;
  if (assist) {
    const need = gAt(T, s.x + 0.45 + 0.9);
    if (need > top(s) + 0.01 && s.n < 6 && s.f - s.lastTap > 8) { tap(s); s.ev.push({ t: 'assist' }); }
  }
  s.x += s.v;
  const front = s.x + 0.45, wall = gAt(T, front);
  if (top(s) < wall - 0.06) { s.status = 'lost'; s.why = 'bonk'; s.short = Math.ceil(wall - top(s) - 0.06); s.ev.push({ t: 'crash', why: 'bonk', short: s.short }); return s; }
  if (s.base < wall - 0.06) {
    const k = Math.min(s.n, Math.ceil(wall - s.base - 0.06));
    s.n -= k; s.base += k; s.walls++;
    const perfect = s.n === 0;
    if (perfect) { s.perfects++; s.streak++; if (s.streak >= 3 && s.fever <= 0) { s.fever = FEVER_FRAMES; s.streak = 0; s.ev.push({ t: 'fever' }); } } else s.streak = 0;
    s.ev.push({ t: 'scrape', k, perfect, streak: s.streak, left: s.n, x: Math.floor(front) });
  }
  const ceil = Math.min(cAt(T, s.x - 0.45, s.f), cAt(T, front, s.f));
  if (top(s) + 0.92 > ceil + 0.02) { s.status = 'lost'; s.why = 'ouch'; s.short = Math.ceil(top(s) + 0.92 - ceil - 0.02); s.ev.push({ t: 'crash', why: 'ouch', short: s.short }); return s; }
  const sup = Math.max(gAt(T, s.x - 0.42), gAt(T, s.x + 0.42));
  if (s.base > sup + 0.001 || s.vy > 0) {
    s.vy -= GRAV; s.base += s.vy;
    if (s.base <= sup) {
      const hard = -s.vy; s.base = sup; s.vy = 0;
      if (T.springs.includes(Math.floor(s.x))) { s.vy = SPRING_VY; s.ev.push({ t: 'spring' }); }
      else if (hard > 0.12) s.ev.push({ t: 'land', hard });
    }
  } else {
    s.base = sup;
    if (T.springs.includes(Math.floor(s.x)) && s.f > 3) { s.vy = SPRING_VY; s.ev.push({ t: 'spring' }); }
  }
  // items: the hero box is 1 wide and 0.94 tall on top of the stack
  const t0 = top(s);
  for (const it of T.items) {
    if (s.got[it.i] || Math.abs(it.x - s.x) > 0.62) continue;
    if (it.y + 1 > t0 + 0.05 && it.y < t0 + 0.94) {
      s.got[it.i] = true;
      if (it.kind === 'gem') { s.gemsGot++; s.ev.push({ t: 'gem', i: it.i, n: s.gemsGot }); }
      else { s.n++; s.ev.push({ t: 'plus', i: it.i }); }
    }
  }
  if (s.x >= T.finishX) { s.status = 'won'; s.ev.push({ t: 'win' }); }
  return s;
}

// ---- stars: 1 = cleared, 2 = every gem, 3 = every gem and every wall flush (no spare block left on it)
export function stars(s, perfReq) {
  if (s.status !== 'won') return 0;
  const all = s.gemsGot >= s.T.gemTotal;
  return !all ? 1 : s.perfects >= perfReq ? 3 : 2;
}

// ---- solver: layered search over (frame slots) with taps allowed at most every 8 frames (7 taps a second)
// returns { clear, gems, perfects, taps:[frames], best:{gems,perfects} } for the best run found
export function solve(T, speed, { slot = 4, minGap = 8, maxN = 7 } = {}) {
  let layer = new Map(); const s0 = start(T, speed); s0.walls = 0;
  const key = (s) => `${s.n}|${s.base.toFixed(2)}|${s.vy.toFixed(2)}|${s.got.map(g => g ? 1 : 0).join('')}|${Math.min(s.f - s.lastTap, minGap)}`;
  s0.path = []; layer.set(key(s0), s0);
  let best = null;
  const score = (s) => s.gemsGot * 1000 + s.perfects * 10 - s.taps * 0.001;
  while (layer.size) {
    const next = new Map();
    for (const s of layer.values()) {
      for (const doTap of (s.f - s.lastTap >= minGap && s.n < maxN) ? [false, true] : [false]) {
        const c = clone(s); c.path = s.path;
        if (doTap) { tap(c); c.path = s.path.concat(c.f); }
        for (let i = 0; i < slot && c.status === 'play'; i++) step(c);
        if (c.status === 'lost') continue;
        if (c.status === 'won') { if (!best || score(c) > score(best)) best = c; continue; }
        const k = key(c), old = next.get(k);
        if (!old || score(c) > score(old)) next.set(k, c);
      }
    }
    layer = next;
  }
  if (!best) return { clear: false };
  return { clear: true, got: best.got, gems: best.gemsGot, perfects: best.perfects, walls: best.walls, taps: best.path, total: T.gemTotal, f: best.f };
}

// Garden Gather match-3 engine: rules (runs, L/T, 2x2, specials + combos, crates, brambles, cloches, mud, pots),
// gravity with diagonal slides, cascades, shuffles, hints, a greedy bot, and a calm 2D canvas renderer
// for the painted storybook sprites. `sim: true` runs the same rules with no waits and no drawing (level tuning).
import { rng } from './kit/hc.js';

export const GEMS = ['rose', 'leaf', 'cornflower', 'buttercup', 'lavender', 'daisy'];
export const PETAL = [['#e8909f', '#f6c9d0', '#c85a6e'], ['#8fae6f', '#c5d9a8', '#5d7f45'], ['#5b7bd6', '#a9bdf0', '#3a55a8'],
  ['#f3cd4f', '#fbe7a1', '#d9a521'], ['#a08ad0', '#d3c6ee', '#7a63ad'], ['#fbf7ec', '#f3d36b', '#e9e1cc']];
const SP_IMG = { ph: 'special-posy-h', pv: 'special-posy-v', bee: 'special-bee', fly: 'special-butterfly', wreath: 'special-wreath' };
const GOLD = ['#f3d98b', '#d9b45a', '#fff4cf'];

export function createBoard({ canvas = null, img = {}, hooks = {}, sim = false }) {
  const ctx = sim ? null : canvas.getContext('2d');
  const H_ = (k, ...a) => hooks[k] && hooks[k](...a);
  let speed = 1, reduce = false;
  const T = ms => sim ? null : new Promise(r => setTimeout(r, ms * speed));
  let L = null, W = 7, H = 8, mask = [], cells = [], block = [], cover = [], floor = [], goals = [], bottom = [];
  let moves = 0, movesStart = 0, score = 0, chain = 0, busy = false, over = true, uid = 1, rnd = Math.random;
  let potsToSpawn = 0, potMax = 0, sel = null, hint = null, idle = 0, drag = null, frozen = false;
  let pieces = [], dying = [], parts = [], fx = [], flyers = [];
  const queue = [];
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y][x];
  const at = (x, y) => inB(x, y) ? cells[y][x] : null;
  const colorAt = (x, y) => { const p = at(x, y); return p && p.k === 'gem' && !p.sp ? p.t : -1; };
  const locked = (x, y) => inB(x, y) && cover[y][x] > 0;
  const movable = (x, y) => { const p = at(x, y); return !!p && !locked(x, y) && !p.dying; };

  // ------------------------------------------------------------ setup
  function load(level) {
    L = level; W = L.W; H = L.H; rnd = rng(L.seed || 1);
    mask = L.mask.map(r => r.slice());
    cells = mask.map(r => r.map(() => null)); block = mask.map(r => r.map(() => null));
    cover = mask.map(r => r.map(() => 0)); floor = mask.map(r => r.map(() => 0));
    for (const b of L.blocks || []) if (inB(b.x, b.y)) block[b.y][b.x] = { k: b.k, hp: b.hp };
    for (const c of L.covers || []) if (inB(c.x, c.y) && !block[c.y][c.x]) cover[c.y][c.x] = c.hp;
    for (const f of L.floor || []) if (inB(f.x, f.y) && !block[f.y][f.x]) floor[f.y][f.x] = 1;
    bottom = Array.from({ length: W }, (_, x) => { let b = -1; for (let y = 0; y < H; y++) if (mask[y][x]) b = y; return b; });
    goals = L.goals.map(g => ({ ...g, left: g.n }));
    moves = movesStart = L.moves; score = 0; chain = 0; pieces = []; dying = []; parts = []; fx = []; flyers = []; queue.length = 0;
    potsToSpawn = (L.goals.find(g => g.k === 'pot') || { n: 0 }).n; potMax = L.potMax || 2;
    sel = null; hint = null; idle = 0; drag = null; over = false; busy = false; frozen = false;
    // fill with no ready-made matches, then make sure a move exists
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y][x] || block[y][x]) continue;
      let t, n = 0;
      do { t = (rnd() * L.colors) | 0; n++; } while (n < 40 && wouldMatch(x, y, t));
      const p = mk(t, x, y); p.ry = y - H - 1.5 - (H - y) * 0.15; cells[y][x] = p;
    }
    for (const s of L.pots0 || []) { const p = at(s.x, s.y); if (p && !locked(s.x, s.y)) { p.k = 'pot'; p.t = -1; potsToSpawn--; } }
    if (!validMoves().length) reshuffle(true);
    H_('goals', goals); H_('moves', moves); H_('score', score);
  }
  function wouldMatch(x, y, t) {
    const c = (xx, yy) => colorAt(xx, yy);
    return (c(x - 1, y) === t && c(x - 2, y) === t) || (c(x, y - 1) === t && c(x, y - 2) === t) ||
      (c(x - 1, y) === t && c(x, y - 1) === t && c(x - 1, y - 1) === t);
  }
  function mk(t, x, y, sp = null, k = 'gem') {
    const p = { id: uid++, k, t, sp, gx: x, gy: y, rx: x, ry: y, vy: 0, s: 1, land: 0, born: 1, wob: Math.random() * 6, dying: 0 };
    pieces.push(p); return p;
  }

  // ------------------------------------------------------------ matching
  function findGroups() {
    const runs = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) { const c = colorAt(x, y); let n = 1; while (c >= 0 && colorAt(x + n, y) === c) n++; if (c >= 0 && n >= 3) runs.push({ d: 'h', n, cells: Array.from({ length: n }, (_, i) => [x + i, y]), c }); x += n; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) { const c = colorAt(x, y); let n = 1; while (c >= 0 && colorAt(x, y + n) === c) n++; if (c >= 0 && n >= 3) runs.push({ d: 'v', n, cells: Array.from({ length: n }, (_, i) => [x, y + i]), c }); y += n; }
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const c = colorAt(x, y); if (c >= 0 && colorAt(x + 1, y) === c && colorAt(x, y + 1) === c && colorAt(x + 1, y + 1) === c) runs.push({ d: 's', n: 4, cells: [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], c }); }
    if (!runs.length) return [];
    const par = runs.map((_, i) => i), f = i => par[i] === i ? i : (par[i] = f(par[i])), owner = new Map();
    runs.forEach((r, i) => r.cells.forEach(([x, y]) => { const k = y * 32 + x; if (owner.has(k)) par[f(i)] = f(owner.get(k)); else owner.set(k, i); }));
    const gm = new Map();
    runs.forEach((r, i) => { const k = f(i); if (!gm.has(k)) gm.set(k, { runs: [], cells: new Map(), c: r.c }); const g = gm.get(k); g.runs.push(r); r.cells.forEach(([x, y]) => g.cells.set(y * 32 + x, [x, y])); });
    return [...gm.values()].map(g => {
      const mh = Math.max(0, ...g.runs.filter(r => r.d === 'h').map(r => r.n)), mv = Math.max(0, ...g.runs.filter(r => r.d === 'v').map(r => r.n));
      const sq = g.runs.some(r => r.d === 's');
      // a 2x2 that is really a straight run of 3 next to one stray gem stays a butterfly only if no line run >= 4 / cross exists
      const kind = mh >= 5 || mv >= 5 ? 'wreath' : mh >= 3 && mv >= 3 ? 'bee' : mh === 4 ? 'pv' : mv === 4 ? 'ph' : sq ? 'fly' : null;
      return { cells: [...g.cells.values()], c: g.c, kind, runs: g.runs };
    });
  }
  function hasMatchAt(x, y) {
    const c = colorAt(x, y); if (c < 0) return false;
    let n = 1; for (let i = 1; colorAt(x - i, y) === c; i++) n++; for (let i = 1; colorAt(x + i, y) === c; i++) n++; if (n >= 3) return true;
    n = 1; for (let i = 1; colorAt(x, y - i) === c; i++) n++; for (let i = 1; colorAt(x, y + i) === c; i++) n++; if (n >= 3) return true;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const ax = x + dx, ay = y + dy; if (colorAt(ax, ay) === c && colorAt(ax + 1, ay) === c && colorAt(ax, ay + 1) === c && colorAt(ax + 1, ay + 1) === c) return true; }
    return false;
  }
  function lswap(a, b) { const pa = cells[a[1]][a[0]], pb = cells[b[1]][b[0]]; cells[a[1]][a[0]] = pb; cells[b[1]][b[0]] = pa; if (pa) { pa.gx = b[0]; pa.gy = b[1]; } if (pb) { pb.gx = a[0]; pb.gy = a[1]; } }
  function validMoves() {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = [x, y], b = [x + dx, y + dy]; if (!movable(...a) || !movable(...b)) continue;
      const pa = at(...a), pb = at(...b);
      if (pa.sp || pb.sp) { out.push({ a, b, sp: true }); continue; }
      const nudge = potDown(pa, pb, a, b);
      if (!nudge && pa.k === 'gem' && pb.k === 'gem' && pa.t === pb.t) continue;
      lswap(a, b); const ok = hasMatchAt(...a) || hasMatchAt(...b); lswap(a, b); if (ok || nudge) out.push({ a, b, nudge });
    }
    return out;
  }
  // a pot can always be slid down one row (costs a move): keeps pot levels calm instead of luck-driven
  const potDown = (pa, pb, a, b) => (pa.k === 'pot' && pb.k === 'gem' && b[1] === a[1] + 1) || (pb.k === 'pot' && pa.k === 'gem' && a[1] === b[1] + 1);
  // value of a move for hints and the bot (a fair, greedy player: it only sees the board, like a person)
  function moveValue(m) {
    const pa = at(...m.a), pb = at(...m.b);
    if (m.sp) { const n = (pa.sp ? 1 : 0) + (pb.sp ? 1 : 0); return 30 + n * 25 + (pa.sp === 'wreath' || pb.sp === 'wreath' ? 20 : 0); }
    lswap(m.a, m.b); const gs = findGroups(); lswap(m.a, m.b);
    let v = m.nudge ? 12 : 0;
    for (const g of gs) {
      v += g.cells.length + ({ wreath: 40, bee: 22, pv: 14, ph: 14, fly: 12 }[g.kind] || 0);
      const goalC = goals.find(o => o.k === 'color' && o.c === g.c && o.left > 0); if (goalC) v += g.cells.length * 3;
      for (const [x, y] of g.cells) {
        if (floor[y][x] && goals.some(o => o.k === 'mud' && o.left > 0)) v += 5;
        if (cover[y][x]) v += 5;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inB(x + dx, y + dy) && block[y + dy][x + dx]) v += 4;
      }
    }
    // help pots down: clearing flowers under a pot lets it drop
    if (potsOnBoard()) {
      for (const g of gs) for (const [x, y] of g.cells) for (let yy = y - 1; yy >= 0; yy--) { const q = at(x, yy); if (q && q.k === 'pot') { v += 10; break; } }
      if ((pa.k === 'pot' && m.b[1] > m.a[1]) || (pb.k === 'pot' && m.a[1] > m.b[1])) v += 18;
    }
    return v + Math.random() * 0.5;
  }
  const potsOnBoard = () => pieces.filter(p => p.k === 'pot' && !p.dying).length;
  function bestMove() { const ms = validMoves(); if (!ms.length) return null; let best = null, bv = -1; for (const m of ms) { const v = moveValue(m); if (v > bv) { bv = v; best = m; } } return best; }

  // ------------------------------------------------------------ goals + hits
  function goal(k, c, x, y) {
    for (let i = 0; i < goals.length; i++) { const g = goals[i]; if (g.k === k && (k !== 'color' || g.c === c) && g.left > 0) { g.left--; H_('goal', i, g, cx(x), cy(y)); return true; } }
    return false;
  }
  const hitOnce = new Set();
  function hitBlock(x, y) {
    const b = block[y][x]; if (!b) return;
    b.hp--; b.shake = 1; score += 30;
    if (!sim) { spark(x, y, b.k === 'crate' ? ['#b88a55', '#7d5a34', '#e8d2a6'] : ['#6f7f4a', '#4b3a2a', '#a7b97c'], 12, { speed: 3, size: 1.2 }); H_('sfx', 'crate'); }
    if (b.hp <= 0) { block[y][x] = null; goal(b.k, 0, x, y); if (!sim) ring(x, y, 1.2, '#f3e3b8'); }
  }
  function clearPiece(p, x, y, pts = 10) {
    if (cells[y][x] === p) cells[y][x] = null;
    p.dying = 1; dying.push(p); const i = pieces.indexOf(p); if (i >= 0) pieces.splice(i, 1);
    score += pts * Math.max(1, chain);
    if (p.k === 'gem' && !p.sp) { if (!sim) petals(x, y, p.t, reduce ? 3 : 7); goal('color', p.t, x, y); }
    if (floor[y][x]) { floor[y][x] = 0; score += 20; goal('mud', 0, x, y); if (!sim) spark(x, y, ['#8a6a48', '#c9a77a', '#fff6e0'], 8, { speed: 2.5 }); }
  }
  function hit(x, y, { adjacent = false, fromMatch = false } = {}) {
    if (!inB(x, y)) return;
    if (block[y][x]) { if (fromMatch) return; const k = 'b' + (y * 32 + x); if (adjacent && hitOnce.has(k)) return; hitOnce.add(k); hitBlock(x, y); return; }
    if (adjacent) return;
    const p = cells[y][x]; if (!p || p.dying) return;
    if (cover[y][x] > 0) {
      const k = 'c' + (y * 32 + x); if (hitOnce.has(k)) return; hitOnce.add(k);
      cover[y][x]--; score += 30;
      if (!sim) { spark(x, y, ['#ffffff', '#dfeef5', '#bcd9e6'], 12, { speed: 3.2 }); H_('sfx', 'glass'); }
      if (cover[y][x] > 0) return;                       // the glass cracked; the flower under it is still safe
      goal('cloche', 0, x, y);
    }
    if (p.k === 'pot') return;                           // pots can't be broken, only brought down
    if (p.sp) { if (!p.fired) { p.fired = true; queue.push([x, y, p]); } return; }
    clearPiece(p, x, y);
  }

  // ------------------------------------------------------------ specials
  function mostColor(exclude = -1) { const n = new Array(6).fill(0); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = colorAt(x, y); if (c >= 0 && c !== exclude) n[c]++; } return n.indexOf(Math.max(...n)); }
  function removeSpecial(p) { const x = p.gx, y = p.gy; if (cells[y]?.[x] === p) cells[y][x] = null; if (!p.dying) { p.dying = 1; dying.push(p); const i = pieces.indexOf(p); if (i >= 0) pieces.splice(i, 1); } }
  async function line(x, y, dir) {
    if (!sim) { fx.push({ k: 'sweep', x, y, dir, t: 0 }); H_('sfx', 'line'); }
    const n = dir === 'h' ? W : H, at0 = dir === 'h' ? x : y;
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - at0) - Math.abs(b - at0));
    for (const i of order) dir === 'h' ? hit(i, y) : hit(x, i);
    await T(220);
  }
  async function blast(x, y, r2) {
    if (!sim) { ring(x, y, Math.sqrt(r2) + 0.8, '#fff1c4'); spark(x, y, GOLD, reduce ? 8 : 26, { speed: 5, size: 1.3 }); H_('sfx', 'bee'); H_('shake', 0.5); }
    const R = Math.ceil(Math.sqrt(r2));
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r2) hit(x + dx, y + dy);
    await T(240);
  }
  function flyTarget(ex) {
    const pri = [[], [], [], []];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inB(x, y) || ex.has(y * 32 + x)) continue;
      const b = block[y][x];
      if (b && goals.some(g => g.k === b.k && g.left > 0)) pri[0].push([x, y]);
      else if (cover[y][x] && goals.some(g => g.k === 'cloche' && g.left > 0)) pri[0].push([x, y]);
      else if (floor[y][x] && goals.some(g => g.k === 'mud' && g.left > 0)) pri[1].push([x, y]);
      else { const c = colorAt(x, y); if (c >= 0 && goals.some(g => g.k === 'color' && g.c === c && g.left > 0)) pri[2].push([x, y]); else if (c >= 0 || b) pri[3].push([x, y]); }
    }
    const l = pri.find(l => l.length); return l ? l[(rnd() * l.length) | 0] : null;
  }
  async function butterfly(x, y, carry = null, ex = new Set()) {
    const t = flyTarget(ex); if (!t) return; ex.add(t[1] * 32 + t[0]);
    if (!sim) { H_('sfx', 'fly'); await new Promise(res => flyers.push({ img: SP_IMG.fly, x0: x, y0: y, x1: t[0], y1: t[1], t: 0, dur: 0.55, res, carry })); }
    if (carry === 'bee') await blast(t[0], t[1], 5);
    else if (carry === 'ph' || carry === 'pv') await line(t[0], t[1], carry === 'ph' ? 'h' : 'v');
    else hit(t[0], t[1]);
  }
  async function wreathColour(x, y, c, turnInto = null) {
    const targets = [];
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (colorAt(xx, yy) === c) targets.push([xx, yy]);
    if (!sim) { H_('sfx', 'wreath'); fx.push({ k: 'threads', x, y, targets, t: 0 }); spark(x, y, GOLD, 20, { speed: 4 }); }
    await T(380);
    if (turnInto) {
      for (const [xx, yy] of targets) { const p = at(xx, yy); if (p && !p.dying) { p.sp = turnInto === 'line' ? (rnd() < 0.5 ? 'ph' : 'pv') : turnInto; p.t = -1; p.pop = 1; } }
      await T(300);
      for (const [xx, yy] of targets) { const p = at(xx, yy); if (p && p.sp && !p.fired) { p.fired = true; queue.push([xx, yy, p]); } }
    } else for (const [xx, yy] of targets) hit(xx, yy);
  }
  async function activate(x, y, p, partner = null) {
    removeSpecial(p); score += 60; H_('special', p.sp);
    if (p.sp === 'ph' || p.sp === 'pv') await line(x, y, p.sp === 'ph' ? 'h' : 'v');
    else if (p.sp === 'bee') await blast(x, y, 5);
    else if (p.sp === 'fly') { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) hit(x + dx, y + dy); if (!sim) spark(x, y, ['#f1b9c4', '#fff', '#e9c46a'], 12, { speed: 3 }); await butterfly(x, y); }
    else if (p.sp === 'wreath') await wreathColour(x, y, partner ?? mostColor());
  }
  async function combo(a, b, x, y) {
    // a, b = the two special pieces swapped together; fired at (x, y)
    removeSpecial(a); removeSpecial(b); score += 200; H_('special', 'combo');
    const k = [a.sp, b.sp].sort().join('+'), isLine = s => s === 'ph' || s === 'pv';
    if (a.sp === 'wreath' && b.sp === 'wreath') { if (!sim) { H_('sfx', 'wreath'); ring(x, y, 9, '#fff3c9'); } for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) hit(xx, yy); await T(450); return; }
    if (a.sp === 'wreath' || b.sp === 'wreath') { const o = a.sp === 'wreath' ? b : a; await wreathColour(x, y, mostColor(), isLine(o.sp) ? 'line' : o.sp); return; }
    if (isLine(a.sp) && isLine(b.sp)) { await Promise.all([line(x, y, 'h'), line(x, y, 'v')]); return; }
    if (k === 'bee+bee') { await blast(x, y, 10); return; }
    if ((isLine(a.sp) && b.sp === 'bee') || (isLine(b.sp) && a.sp === 'bee')) { for (const d of [-1, 0, 1]) { line(x, y + d, 'h'); line(x + d, y, 'v'); } await T(320); return; }
    if (a.sp === 'fly' && b.sp === 'fly') { const ex = new Set(); await Promise.all([butterfly(x, y, null, ex), butterfly(x, y, null, ex), butterfly(x, y, null, ex)]); return; }
    const other = a.sp === 'fly' ? b : a; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) hit(x + dx, y + dy); await butterfly(x, y, other.sp);
  }
  async function drain() {
    while (queue.length) {
      const [x, y, p] = queue.shift();
      const gx = p.gx, gy = p.gy;
      await activate(cells[gy]?.[gx] === p ? gx : x, cells[gy]?.[gx] === p ? gy : y, p);
    }
  }

  // ------------------------------------------------------------ gravity
  function gravity() {
    let changed = true, spawned = new Array(W).fill(0);
    while (changed) {
      changed = false;
      for (let x = 0; x < W; x++) {
        // walk the column bottom-up in segments split by crates/brambles and locked (cloched) flowers
        let y = H - 1;
        while (y >= 0) {
          const seg = [];
          while (y >= 0 && !(mask[y][x] && (block[y][x] || cover[y][x]))) { if (mask[y][x]) seg.push(y); y--; }
          const open = y < 0;                             // nothing solid above: new flowers can drop in
          const ps = seg.map(yy => cells[yy][x]).filter(Boolean);
          seg.forEach((yy, i) => { const p = ps[i] || null; if (cells[yy][x] !== p) changed = true; cells[yy][x] = p; if (p) { p.gx = x; p.gy = yy; } });
          if (open) for (let i = ps.length; i < seg.length; i++) {
            const yy = seg[i]; let p;
            if (potsToSpawn > 0 && potsOnBoard() < potMax && rnd() < 0.35) { p = mk(-1, x, yy, null, 'pot'); potsToSpawn--; }
            else p = mk((rnd() * L.colors) | 0, x, yy);
            p.ry = -1 - spawned[x]++ * 1.05; p.rx = x; p.vy = 3; cells[yy][x] = p; changed = true;
          }
          y--;                                            // skip the solid cell
        }
      }
      // diagonal slides into holes under solid cells
      for (let y = H - 1; y >= 1 && !changed; y--) for (let x = 0; x < W; x++) {
        if (!mask[y][x] || block[y][x] || cells[y][x]) continue;
        for (const dx of rnd() < 0.5 ? [-1, 1] : [1, -1]) {
          const sx = x + dx, sy = y - 1;
          if (inB(sx, sy) && cells[sy][sx] && !cover[sy][sx] && !block[sy][sx]) {
            // only if that neighbour can't simply fall straight down
            const below = inB(sx, y) ? (block[y][sx] || cover[y][sx] || cells[y][sx]) : true;
            if (!below) continue;
            const p = cells[sy][sx]; cells[sy][sx] = null; cells[y][x] = p; p.gx = x; p.gy = y; changed = true; break;
          }
        }
        if (changed) break;
      }
    }
  }
  function collectPots() {
    let n = 0;
    for (let x = 0; x < W; x++) { const y = bottom[x]; const p = y >= 0 ? cells[y][x] : null; if (p && p.k === 'pot' && !cover[y][x]) { cells[y][x] = null; p.dying = 1; p.potOut = 1; dying.push(p); pieces.splice(pieces.indexOf(p), 1); goal('pot', 0, x, y); score += 100; n++; if (!sim) { spark(x, y, ['#c9774a', '#f2d4b0', '#7aa35a'], 14, { speed: 3 }); H_('sfx', 'pot'); } } }
    return n;
  }
  async function settle() {
    gravity(); if (!sim) await waitLanded();
    while (collectPots()) { await T(200); gravity(); if (!sim) await waitLanded(); }
  }
  function waitLanded() { return new Promise(res => { const chk = () => (pieces.every(p => Math.abs(p.ry - p.gy) < 0.01 && Math.abs(p.rx - p.gx) < 0.01) ? res() : setTimeout(chk, 30)); setTimeout(chk, 40); }); }

  // ------------------------------------------------------------ resolve a move
  async function resolve(swap = null, maxLoops = 40) {
    chain = 0;
    if (!findGroups().length) await settle();             // e.g. a pot nudged onto the bottom row
    for (let guard = 0; guard < maxLoops; guard++) {
      hitOnce.clear();
      const gs = findGroups();
      if (!gs.length && !queue.length) break;
      chain++;
      if (gs.length) {
        H_('match', chain, gs);
        const made = [];
        for (const g of gs) {
          let spot = null;
          if (g.kind) {
            if (swap) spot = g.cells.find(([x, y]) => (x === swap[0][0] && y === swap[0][1]) || (x === swap[1][0] && y === swap[1][1]));
            if (!spot) { const s = [...g.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]); spot = s[s.length >> 1]; if (g.kind === 'bee') spot = g.cells.find(([x, y]) => g.cells.filter(([a, b]) => a === x || b === y).length >= 5) || spot; }
          }
          for (const [x, y] of g.cells) hit(x, y, { fromMatch: true });
          for (const [x, y] of g.cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) hit(x + dx, y + dy, { adjacent: true });
          if (g.kind && spot) made.push([spot, g.kind]);
        }
        for (const [[x, y], kind] of made) {
          if (cells[y][x] || block[y][x] || cover[y][x]) continue;
          const p = mk(-1, x, y, kind); p.born = 0; p.pop = 1; cells[y][x] = p; score += 40;
          if (!sim) { spark(x, y, GOLD, 14, { speed: 2.6 }); H_('made', kind); }
        }
        await T(170);
      }
      await drain();
      await T(60);
      await settle();
      swap = null;
    }
    if (chain >= 3) H_('praise', chain);
    H_('score', score);
  }
  async function trySwap(a, b) {
    if (busy || over || frozen) return false;
    if (!movable(...a) || !movable(...b)) return false;
    const pa = at(...a), pb = at(...b);
    busy = true; hint = null; idle = 0; sel = null; H_('sfx', 'swap');
    const nudge = potDown(pa, pb, a, b);
    lswap(a, b); pa.sw = pb.sw = 1;
    if (!sim) await T(150);
    if (pa.sp && pb.sp) {
      moves--; H_('moves', moves); chain = 1;
      await combo(pa, pb, b[0], b[1]); await drain(); await settle(); await resolve();
    } else if (pa.sp || pb.sp) {
      moves--; H_('moves', moves); chain = 1;
      const s = pa.sp ? pa : pb, o = pa.sp ? pb : pa;
      if (!s.fired) { s.fired = true; await activate(s.gx, s.gy, s, o.k === 'gem' ? o.t : null); }
      await drain(); await settle(); await resolve();
    } else if (hasMatchAt(...a) || hasMatchAt(...b) || nudge) {
      moves--; H_('moves', moves);
      await resolve([a, b]);
    } else {
      lswap(a, b); pa.sw = pb.sw = 1; H_('sfx', 'nope'); if (!sim) await T(160); busy = false; return false;
    }
    await afterMove();
    return true;
  }
  async function afterMove() {
    H_('score', score);
    if (goals.every(g => g.left <= 0)) { over = true; busy = false; H_('won', { moves, movesStart, score }); return; }
    if (moves <= 0) { over = true; busy = false; H_('lost', { goals, score, frac: fracDone() }); return; }
    if (!validMoves().length) { if (!sim) { H_('toast', 'No moves left, so the flowers are re-planted'); await T(600); } reshuffle(); if (!sim) await T(400); await resolve(); }
    busy = false;
  }
  const fracDone = () => { let a = 0, b = 0; for (const g of goals) { a += g.n - Math.max(0, g.left); b += g.n; } return b ? a / b : 0; };
  function reshuffle(silent = false) {
    const spots = [], kinds = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(x, y); if (p && p.k === 'gem' && !p.sp && !locked(x, y)) { spots.push(p); kinds.push(p.t); } }
    for (let tries = 0; tries < 60; tries++) {
      for (let i = kinds.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
      spots.forEach((p, i) => p.t = kinds[i]);
      if (!findGroups().length && validMoves().length) break;
      if (tries > 40) for (const p of spots) p.t = (rnd() * L.colors) | 0;
    }
    if (!silent) for (const p of spots) p.pop = 1;
  }
  // continue after a reward: +n moves
  function addMoves(n) { moves += n; over = false; busy = false; H_('moves', moves); }
  // booster: trowel = one cell (also one blocker layer), can = a whole row
  async function useBooster(kind, x, y) {
    if (busy || over || (kind !== 'shuffle' && !inB(x, y))) return false;
    busy = true; hint = null; idle = 0; hitOnce.clear(); chain = 1;
    if (kind === 'shuffle') { reshuffle(); if (!sim) { H_('sfx', 'wreath'); await T(450); } }
    else if (kind === 'trowel') { if (!sim) { ring(x, y, 1, '#fff1c4'); H_('sfx', 'trowel'); } hit(x, y); await T(160); }
    else if (kind === 'can') { if (!sim) H_('sfx', 'water'); await line(x, y, 'h'); }
    await drain(); await settle(); await resolve();
    await afterMove();
    return true;
  }
  // the garden party: leftover moves become posies that fire (bonus points only, the level is already won)
  async function finale(maxN = 8) {
    busy = true; over = true; const sp0 = speed; speed = Math.min(speed, 0.6);
    const n = Math.min(moves, maxN);
    for (let i = 0; i < n; i++) {
      const c = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (colorAt(x, y) >= 0 && !locked(x, y)) c.push([x, y]);
      if (!c.length) break;
      const [x, y] = c[(rnd() * c.length) | 0], p = at(x, y); p.sp = rnd() < 0.5 ? 'ph' : 'pv'; p.t = -1; p.pop = 1; moves--; score += 50;
      H_('moves', moves); if (!sim) { spark(x, y, GOLD, 10, { speed: 2.4 }); H_('sfx', 'made'); } await T(140);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(x, y); if (p && p.sp && !p.fired) { p.fired = true; queue.push([x, y, p]); } }
    chain = 1; await drain(); await settle(); await resolve(null, 3);
    H_('score', score); busy = false; speed = sp0;
  }

  // ------------------------------------------------------------ input (swipe or tap-tap)
  function cellAt(px, py) { const x = Math.floor((px - ox) / cs), y = Math.floor((py - oy) / cs); return inB(x, y) ? [x, y] : null; }
  const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  let boosterMode = null;
  function down(px, py) {
    if (over || busy) return; const c = cellAt(px, py); if (!c) { sel = null; return; }
    if (boosterMode) { const k = boosterMode; boosterMode = null; H_('boosterUsed', k, c); return; }
    idle = 0; hint = null;
    if (sel && adj(sel, c)) { const a = sel; sel = null; trySwap(a, c); return; }
    drag = { c, px, py }; sel = movable(...c) ? c : null; if (sel) H_('sfx', 'pick');
  }
  function move(px, py) {
    if (!drag || busy || over) return;
    const dx = px - drag.px, dy = py - drag.py; if (Math.hypot(dx, dy) < cs * 0.38) return;
    const d = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)], b = [drag.c[0] + d[0], drag.c[1] + d[1]];
    const a = drag.c; drag = null; sel = null; if (inB(...b)) trySwap(a, b);
  }
  function up() { drag = null; }

  // ------------------------------------------------------------ rendering
  let ox = 0, oy = 0, cs = 50, dpr = 1, vw = 0, vh = 0, backing = null, shake = 0;
  const cx = x => ox + (x + 0.5) * cs, cy = y => oy + (y + 0.5) * cs;
  function layout(x, y, w, h, maxCs = 88) {
    cs = Math.floor(Math.min(w / W, h / H, maxCs)); ox = Math.round(x + (w - cs * W) / 2); oy = Math.round(y + (h - cs * H) / 2);
    backing = null;
    return { x: ox, y: oy, w: cs * W, h: cs * H, cs };
  }
  function resize(w, h, ratio) { vw = w; vh = h; dpr = ratio; if (!sim) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); } backing = null; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function buildBacking() {
    const pad = 22, bw = cs * W + pad * 2, bh = cs * H + pad * 2;
    const c = document.createElement('canvas'); c.width = Math.ceil(bw * dpr); c.height = Math.ceil(bh * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.translate(pad, pad);
    const each = (e, r, fill) => { g.fillStyle = fill; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x]) { rr(g, x * cs - e, y * cs - e, cs + 2 * e, cs + 2 * e, r); g.fill(); } };
    g.save(); g.filter = 'blur(9px)'; g.translate(0, 6); each(8, 14, 'rgba(70,52,30,.32)'); g.restore();
    each(9, 14, '#a8822f'); each(7, 12, '#f1dc9f'); each(5, 10, '#c9a24a'); each(3, 8, '#fbf7ec');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x]) {
      g.fillStyle = (x + y) % 2 ? '#f3ead6' : '#faf5e9'; g.fillRect(x * cs, y * cs, cs, cs);
    }
    if (img.paper) { g.save(); g.globalAlpha = 0.28; g.globalCompositeOperation = 'multiply'; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x]) { g.save(); g.beginPath(); g.rect(x * cs, y * cs, cs, cs); g.clip(); g.drawImage(img.paper, (x * cs) % 256 - 256 * 0, (y * cs) % 256, 512, 512); g.restore(); } g.restore(); }
    // fine gold hairlines between cells
    g.strokeStyle = 'rgba(176,136,52,.18)'; g.lineWidth = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x]) g.strokeRect(x * cs + 0.5, y * cs + 0.5, cs - 1, cs - 1);
    backing = { c, pad };
  }
  function drawSprite(name, x, y, size, { a = 1, sx = 1, sy = 1, rot = 0 } = {}) {
    const im = img[name]; if (!im) return; const k = size / Math.max(im.width, im.height), w = im.width * k, h = im.height * k;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx, sy); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  }
  function petals(x, y, t, n) { const c = PETAL[t]; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 0.9 + Math.random() * 1.6; parts.push({ k: 'petal', x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, life: 0.9 + Math.random() * 0.4, max: 1.3, size: 0.13 + Math.random() * 0.08, c: c[i % c.length], g: 2.2 }); } }
  function spark(x, y, colors, n, { speed = 3, size = 1, life = 0.7 } = {}) { if (reduce) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = speed * (0.3 + Math.random() * 0.8); parts.push({ k: 'spark', x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6, vr: 2, life, max: life, size: 0.07 * size * (0.6 + Math.random() * 0.8), c: colors[i % colors.length], g: 1.5 }); } }
  function ring(x, y, r, color) { fx.push({ k: 'ring', x, y, r, color, t: 0 }); }

  let last = performance.now(), time = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * (1 / speed); last = now; time += dt;
    if (!over && !busy) { idle += dt; if (idle > (L && L.n <= 3 ? 3.5 : 6) && !hint && !frozen) { const m = bestMove(); if (m) hint = { ...m, t: 0 }; } }
    // pieces
    for (const p of pieces) {
      if (p.sw) p.sw = Math.max(0, p.sw - dt * 4);
      if (p.ry < p.gy - 0.001 && !p.sw) { p.vy += 44 * dt; p.ry = Math.min(p.gy, p.ry + p.vy * dt); const f = 1 - Math.max(0, Math.min(1, (p.gy - p.ry))); p.rx += (p.gx - p.rx) * Math.min(1, dt * 14 * (0.3 + f)); if (p.ry >= p.gy) { p.vy = 0; p.land = 1; p.rx = p.gx; if (!sim && Math.random() < 0.25) H_('sfx', 'land'); } }
      else { p.vy = 0; p.ry += (p.gy - p.ry) * Math.min(1, dt * 18); p.rx += (p.gx - p.rx) * Math.min(1, dt * 18); if (Math.abs(p.rx - p.gx) < 0.002) p.rx = p.gx; if (Math.abs(p.ry - p.gy) < 0.002) p.ry = p.gy; }
      p.land = Math.max(0, p.land - dt * 5); p.born = Math.min(1, p.born + dt * 5); if (p.pop) p.pop = Math.max(0, p.pop - dt * 3);
    }
    for (const p of dying) p.dying += dt * 4.5;
    dying = dying.filter(p => p.dying < 2);
    for (const q of parts) { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.985; q.r += q.vr * dt; q.life -= dt; }
    parts = parts.filter(q => q.life > 0);
    for (const f of fx) f.t += dt;
    fx = fx.filter(f => f.t < (f.k === 'threads' ? 0.6 : f.k === 'sweep' ? 0.5 : 0.6));
    for (const f of flyers) { f.t += dt / f.dur; if (f.t >= 1 && !f.done) { f.done = true; f.res(); } }
    flyers = flyers.filter(f => !f.done);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const b = block[y]?.[x]; if (b && b.shake) b.shake = Math.max(0, b.shake - dt * 4); }
    shake = Math.max(0, shake - dt * 3);
    draw();
  }
  function draw() {
    if (sim || !L) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
    if (!backing) buildBacking();
    const sh = shake && !reduce ? Math.sin(time * 60) * shake * 3 : 0;
    ctx.save(); ctx.translate(sh, 0);
    ctx.drawImage(backing.c, ox - backing.pad, oy - backing.pad, backing.c.width / dpr, backing.c.height / dpr);
    // clip falling flowers to the board top so they slide in from behind the frame
    ctx.save(); ctx.beginPath(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x]) ctx.rect(ox + x * cs - 1, oy + y * cs - (y === 0 || !mask[y - 1][x] ? 0 : 1), cs + 2, cs + 2); ctx.clip();
    // mud under flowers
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x] && floor[y][x]) drawSprite('mud', cx(x), cy(y), cs * 0.98, { a: 0.92 });
    // selection + hint glow
    if (sel) { ctx.save(); ctx.strokeStyle = '#b08834'; ctx.lineWidth = 3; ctx.shadowColor = 'rgba(176,136,52,.6)'; ctx.shadowBlur = 8; rr(ctx, ox + sel[0] * cs + 3, oy + sel[1] * cs + 3, cs - 6, cs - 6, 10); ctx.stroke(); ctx.restore(); }
    if (hint) hint.t += 1 / 60;
    const hs = hint ? Math.sin(hint.t * 4) * 0.5 + 0.5 : 0;
    // flowers
    for (const p of pieces) {
      const X = ox + (p.rx + 0.5) * cs, Y = oy + (p.ry + 0.5) * cs;
      let size = cs * (p.k === 'pot' ? 0.86 : p.sp ? 0.92 : 0.84), sx = 1 + p.land * 0.06, sy = 1 - p.land * 0.08, rot = 0, ddx = 0, ddy = 0;
      if (p.born < 1) size *= 0.5 + 0.5 * p.born;
      if (p.pop) { const k = 1 + Math.sin(p.pop * Math.PI) * 0.25; sx *= k; sy *= k; }
      if (hint && ((p.gx === hint.a[0] && p.gy === hint.a[1]) || (p.gx === hint.b[0] && p.gy === hint.b[1]))) {
        const o = p.gx === hint.a[0] && p.gy === hint.a[1] ? hint.b : hint.a; ddx = (o[0] - p.gx) * hs * cs * 0.1; ddy = (o[1] - p.gy) * hs * cs * 0.1; sx *= 1 + hs * 0.06; sy *= 1 + hs * 0.06;
      }
      if (sel && p.gx === sel[0] && p.gy === sel[1]) { sx *= 1.08; sy *= 1.08; }
      if (p.sp === 'wreath') rot = time * 0.6; else if (p.sp === 'bee') rot = Math.sin(time * 3 + p.wob) * 0.12; else if (p.sp === 'fly') sx *= 0.82 + 0.18 * Math.abs(Math.cos(time * 5 + p.wob)); else if (p.sp) rot = Math.sin(time * 2 + p.wob) * 0.06;
      // soft contact shadow
      ctx.fillStyle = 'rgba(80,60,35,.13)'; ctx.beginPath(); ctx.ellipse(X + ddx, Y + ddy + size * 0.36, size * 0.34, size * 0.09, 0, 0, 6.283); ctx.fill();
      if (p.sp) { const g = ctx.createRadialGradient(X, Y, 0, X, Y, cs * 0.55); g.addColorStop(0, 'rgba(255,240,190,.55)'); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.fillRect(X - cs * 0.6, Y - cs * 0.6, cs * 1.2, cs * 1.2); }
      drawSprite(p.k === 'pot' ? 'pot' : p.sp ? SP_IMG[p.sp] : GEMS[p.t], X + ddx, Y + ddy + (1 - sy) * size * 0.4, size, { sx, sy, rot });
    }
    for (const p of dying) {
      const X = ox + (p.rx + 0.5) * cs, Y = oy + (p.ry + 0.5) * cs, k = p.dying;
      if (k < 1) drawSprite(p.k === 'pot' ? 'pot' : p.sp ? SP_IMG[p.sp] : GEMS[p.t], X, Y - (p.potOut ? k * cs * 0.8 : 0), cs * 0.84 * (1 + k * 0.3), { a: 1 - k });
    }
    ctx.restore();
    // blockers + glass
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y][x]) continue; const b = block[y][x];
      if (b) { const j = b.shake ? Math.sin(time * 70) * b.shake * 2.5 : 0; drawSprite(b.k === 'crate' ? (b.hp > 1 ? 'crate' : 'crate-cracked') : (b.hp > 1 ? 'bramble-thick' : 'bramble-thin'), cx(x) + j, cy(y), cs * (b.k === 'crate' ? 0.98 : 1.02)); }
      if (cover[y][x] > 0) drawSprite(cover[y][x] > 1 ? 'cloche' : 'cloche-cracked', cx(x), cy(y) - cs * 0.04, cs * 0.98, { a: 0.85 });
    }
    // effects
    for (const f of fx) {
      if (f.k === 'ring') { const k = f.t / 0.6; ctx.save(); ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = f.color; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(cx(f.x), cy(f.y), cs * f.r * (0.3 + k * 0.9), 0, 6.283); ctx.stroke(); ctx.restore(); }
      else if (f.k === 'sweep') {
        const k = f.t / 0.5; ctx.save(); ctx.globalAlpha = (1 - k) * 0.55; const g = f.dir === 'h' ? ctx.createLinearGradient(0, cy(f.y) - cs / 2, 0, cy(f.y) + cs / 2) : ctx.createLinearGradient(cx(f.x) - cs / 2, 0, cx(f.x) + cs / 2, 0);
        g.addColorStop(0, 'rgba(255,236,170,0)'); g.addColorStop(0.5, 'rgba(255,244,205,1)'); g.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = g;
        if (f.dir === 'h') { const w = cs * W * Math.min(1, k * 2.5); ctx.fillRect(cx(f.x) - w / 2, cy(f.y) - cs / 2, w, cs); } else { const h = cs * H * Math.min(1, k * 2.5); ctx.fillRect(cx(f.x) - cs / 2, cy(f.y) - h / 2, cs, h); }
        ctx.restore();
      } else if (f.k === 'threads') {
        const k = f.t / 0.6; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 2;
        for (const [x, y] of f.targets) { ctx.beginPath(); ctx.moveTo(cx(f.x), cy(f.y)); const mx = (cx(f.x) + cx(x)) / 2, my = (cy(f.y) + cy(y)) / 2 - cs; ctx.quadraticCurveTo(mx, my, cx(x), cy(y)); ctx.stroke(); }
        ctx.restore();
      }
    }
    for (const f of flyers) {
      const t = Math.min(1, f.t), e = t * t * (3 - 2 * t), x0 = cx(f.x0), y0 = cy(f.y0), x1 = cx(f.x1), y1 = cy(f.y1);
      const mx = (x0 + x1) / 2 + (y1 - y0) * 0.3, my = (y0 + y1) / 2 - cs * 1.6;
      const X = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * mx + e * e * x1, Y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * my + e * e * y1;
      drawSprite(f.img, X, Y, cs * 0.95, { sx: 0.75 + 0.25 * Math.abs(Math.cos(time * 14)) });
      if (f.carry) drawSprite(SP_IMG[f.carry], X, Y + cs * 0.35, cs * 0.6);
      if (Math.random() < 0.5) parts.push({ k: 'spark', x: (X - ox) / cs, y: (Y - oy) / cs, vx: 0, vy: 0.3, r: 0, vr: 1, life: 0.4, max: 0.4, size: 0.05, c: '#f5dc8c', g: 0 });
    }
    for (const q of parts) {
      const X = ox + q.x * cs, Y = oy + q.y * cs, a = Math.max(0, Math.min(1, q.life / q.max * 1.4));
      ctx.save(); ctx.globalAlpha = a; ctx.translate(X, Y); ctx.rotate(q.r); ctx.fillStyle = q.c;
      if (q.k === 'petal') { const s = q.size * cs; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.2, -s * 0.75, s, 0); ctx.quadraticCurveTo(-s * 0.2, s * 0.75, -s, 0); ctx.fill(); ctx.globalAlpha *= 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.12, s * 0.4, s * 0.12, 0, 0, 6.283); ctx.fill(); }
      else { const s = q.size * cs; ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  }

  return {
    load, layout, resize, frame, down, move, up, trySwap, useBooster, addMoves, finale, bestMove, validMoves,
    setBooster(k) { boosterMode = k; }, get boosterMode() { return boosterMode; },
    setSpeed(s) { speed = s; }, setReduce(r) { reduce = r; }, freeze(f) { frozen = f; if (f) { hint = null; sel = null; } },
    shake(v) { shake = Math.max(shake, v); },
    get busy() { return busy; }, get over() { return over; }, get moves() { return moves; }, get movesStart() { return movesStart; },
    get score() { return score; }, get goals() { return goals; }, get level() { return L; }, get cs() { return cs; },
    cellCenter: (x, y) => [cx(x), cy(y)], frac: fracDone,
    cellAt,
    debug: () => ({ unl: pieces.filter(p => Math.abs(p.ry - p.gy) >= 0.01 || Math.abs(p.rx - p.gx) >= 0.01).map(p => [p.rx, p.ry, p.gx, p.gy, p.vy, p.sw]), q: queue.length, W, H, cells: cells.map(r => r.map(p => p ? (p.sp || (p.k === 'pot' ? 'P' : p.t)) : '.')), block, cover, floor }),
  };
}

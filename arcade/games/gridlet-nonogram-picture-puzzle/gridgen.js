// gridgen.js — Gridlet pictures + line solver (pure, no DOM). Our own pixel art, MIT.
// Each picture becomes a nonogram. The line solver (every placement of a line's clue blocks that fits what is known;
// cells that agree in all of them are forced) must finish the grid; if it ever stalls we pre-fill one cell and go on,
// so every puzzle is unique and solvable line by line without guessing.
const C = { r: '#ef5a6f', R: '#d83a4a', o: '#ff9a3c', y: '#ffcb3d', g: '#46b36b', d: '#2f7f4a', b: '#4a8fe0', B: '#3a5fb0', c: '#e0a96d', w: '#f4f1ea', k: '#3a2f45', p: '#ff8fb8', v: '#9b6dff', s: '#b4b0c6', t: '#7ec8e3', n: '#9a6a44' };
const I = (name, rows, pal = {}) => ({ name, rows, pal: { ...C, ...pal } });
export const ICONS = {
  5: [
    I('Heart', ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..']),
    I('Star', ['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.']),
    I('Tree', ['..g..', '.ggg.', 'ggggg', '..n..', '.nnn.']),
    I('Smile', ['.yyy.', 'y.y.y', 'yyyyy', 'y...y', '.yyy.']),
    I('Mushroom', ['.rrr.', 'rrwrr', 'rrrrr', '.www.', '.www.']),
    I('Ghost', ['.vvv.', 'v.v.v', 'vvvvv', 'vvvvv', 'v.v.v']),
    I('Bell', ['..y..', '.yyy.', '.yyy.', 'yyyyy', '..o..']),
    I('Arrow', ['..b..', '.bbb.', 'b.b.b', '..b..', '..b..']),
    I('Flower', ['.p.p.', 'ppypp', '.p.p.', '..g..', '.gg..']),
    I('House', ['..r..', '.rrr.', 'rrrrr', '.wnw.', '.wnw.']),
    I('Sailboat', ['..w..', '..ww.', '..www', 'bbbbb', '.bbb.']),
    I('Cherries', ['...g.', '..gg.', '.g..g', 'rr.rr', 'rr.rr']),
    I('Moon', ['.yyy.', 'yy...', 'yy...', 'yy...', '.yyy.']),
    I('Gem', ['.....', '.ttt.', 'ttttt', '.ttt.', '..t..']),
  ],
  8: [
    I('Apple', ['...ngg..', '...n....', '.rrrrrr.', 'rrrrrrrr', 'rrrrrrwr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..']),
    I('Duck', ['..yyy...', '.yy.y...', 'ooyyy...', '..yyy...', '.yyyyyyy', '.yyyyyy.', '..yyyy..', 'bbbbbbbb']),
    I('Umbrella', ['...vv...', '.vvvvvv.', 'vvvvvvvv', 'v..vv..v', '....k...', '....k...', '....k.k.', '.....k..']),
    I('Crown', ['y..yy..y', 'yy.yy.yy', 'yyyyyyyy', 'yryyyyry', 'yyyyyyyy', 'yyyrryyy', 'yyyyyyyy', '.yyyyyy.']),
    I('Rocket', ['...rr...', '..rwwr..', '..wbbw..', '..wbbw..', '..wwww..', '.rwwwwr.', 'rr.oo.rr', '...oo...']),
    I('Ice cream', ['..pppp..', '.pppppp.', 'pppppppp', '.cccccc.', '..cccc..', '..cccc..', '...cc...', '...c....']),
    I('Music', ['...kkkkk', '...kkkkk', '...k...k', '...k...k', '...k...k', '.kkk.kkk', 'kkkk.kkk', '.kk...kk']),
    I('Candle', ['...o....', '...oo...', '..oyo...', '...k....', '..wwww..', '..wwww..', '..wwww..', '.nnnnnn.']),
    I('Ladybug', ['..k..k..', '...kk...', '.rrkkrr.', 'rkrkkrkr', 'rrrkkrrr', 'rkrkkrkr', '.rrkkrr.', '..rkkr..']),
    I('Anchor', ['...BB...', '..B..B..', '...BB...', '.BBBBBB.', '...BB...', 'B..BB..B', 'BB.BB.BB', '.BBBBBB.']),
    I('Mug', ['.w..w...', '..w..w..', '.w..w...', 'bbbbbb..', 'bbbbbbbb', 'bbbbbb.b', 'bbbbbbbb', '.bbbb...']),
    I('Cactus', ['...gg...', '...gg.g.', 'g..gg.g.', 'g..gggg.', 'ggggg...', '...gg...', '.cccccc.', '..cccc..']),
    I('Butterfly', ['pp....pp', 'ppp..ppp', 'pppkkppp', '.ppkkpp.', '.vvkkvv.', 'vvvkkvvv', 'vvv..vvv', 'vv....vv']),
  ],
  10: [
    I('Cat', ['o........o', 'oo......oo', 'ooo....ooo', 'oooooooooo', 'oo.oooo.oo', 'oo.oooo.oo', 'ooooppoooo', '.oooooooo.', '..oooooo..', '...oooo...']),
    I('Robot', ['....rr....', '....ss....', '.ssssssss.', '.s.ssss.s.', '.ssssssss.', '.ss....ss.', '.ssssssss.', '...ssss...', '.bbbbbbbb.', '.bb....bb.']),
    I('Whale', ['.t.t......', '..t.......', '..bbbbb...', '.bbbbbbb.b', 'bb.bbbbbbb', 'bbbbbbbbb.', 'bwwwwwbbb.', '.bwwwwbb..', '..bbbbb...', 'tttttttttt']),
    I('Lighthouse', ['....yy....', '...kyyk...', '....rr....', '...rrrr...', '...wwww...', '...rrrr...', '..wwwwww..', '..rrrrrr..', '.wwwwwwww.', 'bbbbbbbbbb']),
    I('Owl', ['.n......n.', '.nnnnnnnn.', 'nn..nn..nn', 'nn..nn..nn', 'nnnnyynnnn', 'ncccyycccn', 'nccccccccn', 'nccccccccn', '.nnnnnnnn.', '..yy..yy..']),
    I('Sun', ['....yy....', '.y..yy..y.', '...oooo...', '..oooooo..', 'yyooooooyy', 'yyooooooyy', '..oooooo..', '...oooo...', '.y..yy..y.', '....yy....']),
    I('Strawberry', ['..gggggg..', '...gggg...', '.rrrrrrrr.', 'rryrrrryrr', 'rrrrryrrrr', 'ryrrrrrryr', '.rrryrrrr.', '..rrrrrr..', '...rrrr...', '....rr....']),
    I('Frog', ['.gg....gg.', 'g..g..g..g', 'g..gggg..g', 'gggggggggg', 'gggggggggg', 'gpggggggpg', 'gg......gg', '.gggggggg.', '..gggggg..', '.gg....gg.']),
    I('Castle', ['.r......r.', '.s......s.', 'sss.ss.sss', 'ssssssssss', 'ss.ssss.ss', 'ssssssssss', 'ssssnnssss', 'sssnnnnsss', 'sssnnnnsss', 'ssssssssss']),
    I('Cupcake', ['....rr....', '...pppp...', '..pppppp..', '.pppppppp.', 'pppppppppp', '.cccccccc.', '.cc.cc.cc.', '..cccccc..', '..c.cc.c..', '...cccc...']),
    I('Snowman', ['...kkkk...', '...kkkk...', '..kkkkkk..', '...wwww...', '..w.ww.w..', '..wwwwoo..', '..rrrrrr..', '.wwwwwwww.', 'wwwwkwwwww', '.wwwwwwww.']),
    I('Penguin', ['...kkkk...', '..kkkkkk..', '..kwkkwk..', '..kkookk..', '.kkwwwwkk.', 'kkwwwwwwkk', 'kkwwwwwwkk', '.kwwwwwwk.', '..kwwwwk..', '..oo..oo..']),
    I('Balloon', ['..rrrrr...', '.rrrrrrr..', 'rrwrrrrrr.', 'rwrrrrrrr.', 'rrrrrrrrr.', '.rrrrrrr..', '..rrrrr...', '....r.....', '.....k....', '....k.....']),
  ],
};

export function clues(line) { const out = []; let run = 0; for (const v of line) { if (v === 1) run++; else if (run) { out.push(run); run = 0; } } if (run) out.push(run); return out; }
// line solve one line: known = array of -1/0/1; returns new array or null on contradiction
export function solveLine(cl, known) {
  const n = known.length, canF = new Array(n).fill(false), canE = new Array(n).fill(false);
  // memoised placement check: fits(i, k) = blocks k.. can be placed starting at or after i
  const memo = new Map();
  const fits = (i, k) => {
    const key = i * 32 + k; if (memo.has(key)) return memo.get(key);
    let ok = false;
    if (k === cl.length) { ok = true; for (let j = i; j < n; j++) if (known[j] === 1) { ok = false; break; } if (ok) for (let j = i; j < n; j++) canE[j] = true; memo.set(key, ok); return ok; }
    const len = cl[k];
    for (let s = i; s + len <= n; s++) {
      // cells i..s-1 empty
      let bad = false; for (let j = i; j < s; j++) if (known[j] === 1) { bad = true; break; } if (bad) break;
      let blk = true; for (let j = s; j < s + len; j++) if (known[j] === 0) { blk = false; break; }
      if (!blk) continue;
      if (s + len < n && known[s + len] === 1) continue;
      const next = Math.min(n, s + len + 1);
      if (fits(next, k + 1)) {
        ok = true;
        for (let j = i; j < s; j++) canE[j] = true; for (let j = s; j < s + len; j++) canF[j] = true; if (s + len < n) canE[s + len] = true;
      }
    }
    memo.set(key, ok); return ok;
  };
  if (!fits(0, 0)) return null;
  return known.map((v, j) => v !== -1 ? v : canF[j] && !canE[j] ? 1 : canE[j] && !canF[j] ? 0 : -1);
}
// one forced cell from the current knowledge, or null
export function step(N, rc, cc, st) {
  for (let t = 0; t < 2 * N; t++) {
    const isRow = t < N, i = isRow ? t : t - N;
    const idx = [...Array(N).keys()].map(j => isRow ? i * N + j : j * N + i);
    const res = solveLine(isRow ? rc[i] : cc[i], idx.map(c => st[c]));
    if (!res) return null;
    for (let j = 0; j < N; j++) if (st[idx[j]] === -1 && res[j] !== -1) return { c: idx[j], v: res[j] };
  }
  return null;
}
export function solveAll(N, rc, cc, st0) {
  const st = st0.slice();
  for (let changed = true; changed;) {
    changed = false;
    for (let t = 0; t < 2 * N; t++) {
      const isRow = t < N, i = isRow ? t : t - N, idx = [...Array(N).keys()].map(j => isRow ? i * N + j : j * N + i);
      const res = solveLine(isRow ? rc[i] : cc[i], idx.map(c => st[c])); if (!res) return { ok: false, st };
      for (let j = 0; j < N; j++) if (st[idx[j]] !== res[j]) { st[idx[j]] = res[j]; changed = true; }
    }
  }
  return { ok: st.every(v => v !== -1), st };
}
export function spec(level, fk = 1) { const L = level * fk; return { N: L < 5 ? 5 : L < 14 ? 8 : 10 }; }
export function generate(level, seed, fk, rngf) {
  const { N } = spec(level, fk), r = rngf(seed), set = ICONS[N];
  const pick = Math.floor(r() * set.length * 7) % set.length, icon = set[pick];
  const flip = r() < 0.4;
  const rows = icon.rows.map(s => flip ? s.split('').reverse().join('') : s);
  const sol = [], col = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ch = rows[y][x]; sol.push(ch === '.' ? 0 : 1); col.push(ch === '.' ? null : icon.pal[ch]); }
  const rc = [], cc = [];
  for (let i = 0; i < N; i++) { rc.push(clues(sol.slice(i * N, i * N + N))); cc.push(clues([...Array(N).keys()].map(y => sol[y * N + i]))); }
  // pre-fill cells only if line logic alone stalls
  const given = new Array(N * N).fill(-1);
  for (let guard = 0; guard < N * N; guard++) {
    const res = solveAll(N, rc, cc, given); if (res.ok) break;
    const open = []; for (let c = 0; c < N * N; c++) if (res.st[c] === -1 && sol[c] === 1) open.push(c);
    const c = open.length ? open[Math.floor(r() * open.length)] : res.st.findIndex(v => v === -1);
    given[c] = sol[c];
  }
  return { N, sol, col, rc, cc, given, name: icon.name };
}

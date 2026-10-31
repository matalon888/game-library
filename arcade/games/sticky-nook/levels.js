// Sticky Nook v2 — 30 authored rooms in 3 worlds + a seeded generator (daily room / endless rooms after 30).
// Sticker tokens (tray order): 'bed' · '~bed' hidden under a dust sheet · 'cat<rug' locked until the rug is on ·
// 'pouf@x,y,pink' an extra sticker placed at floor (x,y) tinted pink (kinds: pouf pot gift balloon). Tints = TINT names.
// Pure data + solver: no DOM, so qa/ scripts can import it in node.
export const TINT = { pink: '#ff8fa3', blue: '#7bb7ff', yellow: '#ffd166', mint: '#8ad6a0', lilac: '#b39ddb', coral: '#ff8a65' };
export const NAMES = { bed: 'bed', wardrobe: 'wardrobe', desk: 'desk', chair: 'chair', window: 'window', frame: 'frame', rug: 'rug', plant: 'plant', lamp: 'lamp', cat: 'cat', shelf: 'shelf', clock: 'clock',
  fridge: 'fridge', counter: 'counter', stove: 'stove', cabinets: 'cabinets', table: 'table', cake: 'cake', stool: 'stool', kwindow: 'window', mugs: 'mugs',
  tub: 'tub', duck: 'duck', toilet: 'toilet', sink: 'sink', mirror: 'mirror', washer: 'washer', towels: 'towels', bottles: 'bottles', bathrug: 'rug',
  sofa: 'sofa', cushions: 'cushions', coffee: 'table', tvstand: 'TV', bookshelf: 'books', floorlamp: 'lamp', painting: 'painting', sofacat: 'cat', lrug: 'rug', wclock: 'clock', bigplant: 'plant' };
export const THEME_ITEMS = [
  ['window', 'frame', 'shelf', 'clock', 'rug', 'wardrobe', 'desk', 'bed', 'chair', 'lamp', 'cat', 'plant'],
  ['kwindow', 'mugs', 'cabinets', 'rug', 'fridge', 'counter', 'stove', 'table', 'cake', 'stool', 'cat', 'plant'],
  ['bottles', 'towels', 'mirror', 'bathrug', 'tub', 'duck', 'sink', 'toilet', 'washer', 'cat', 'plant'],
  ['painting', 'wclock', 'lrug', 'bookshelf', 'tvstand', 'sofa', 'cushions', 'sofacat', 'coffee', 'floorlamp', 'bigplant'],
];
// free floor spots per room for extra stickers (checked by eye on phone screenshots)
export const SPOTS = [
  [[7.7, 3.0], [4.4, 9.0], [8.2, 4.6], [5.6, 9.3], [2.0, 9.2], [6.4, 2.6]],
  [[8.2, 4.4], [1.8, 3.7], [8.6, 6.6], [3.2, 9.2], [6.2, 9.0], [4.4, 3.4]],
  [[8.0, 5.0], [7.0, 8.4], [4.4, 9.2], [9.0, 3.2], [6.2, 5.2], [2.6, 9.2]],
  [[8.2, 4.0], [6.5, 8.4], [3.6, 9.2], [8.8, 6.6], [2.4, 9.2], [9.0, 2.6]],
];
const E = (th, i, kind, tint) => `${kind}@${SPOTS[th][i][0]},${SPOTS[th][i][1]},${tint}`;

export function parse(tok, th) {
  let sheet = false, lock = null, s = tok;
  if (s[0] === '~') { sheet = true; s = s.slice(1); }
  const li = s.indexOf('<'); if (li > 0) { lock = s.slice(li + 1); s = s.slice(0, li); }
  const ei = s.indexOf('@');
  if (ei > 0) { const kind = s.slice(0, ei), [a, b, c] = s.slice(ei + 1).split(','); return { id: s, key: s, kind, a: +a, b: +b, c: TINT[c] || c, tint: TINT[c] || c, sheet, lock }; }
  return { id: s, key: s, sheet, lock };
}
// level = { name, th, look, st:[tokens], conv?: seconds per tray turn, rush?: seconds, par?, tip?, why, boss? }
const L = (name, th, look, st, o = {}) => ({ name, th, look, st, ...o });
export const LEVELS = [
  // ---------------- WORLD 1 · Cosy Flat — press, chain, twins, locks
  L('Hello nook', 0, 0, ['bed', 'lamp', 'plant'], { why: 'introduce: press a sticker on its glowing spot; cannot be lost' }),
  L('Kitchen call', 1, 0, ['fridge', 'table', 'cat', 'mugs'], { why: 'second room; first choice of which sticker next' }),
  L('Quick fingers', 2, 0, ['tub', 'sink', 'mirror', 'duck', 'towels'], { why: 'enough stickers to build a chain; hearts matter for the first time' }),
  L('Pillow talk', 0, 1, ['bed', E(0, 0, 'pouf', 'pink'), E(0, 1, 'pouf', 'blue'), 'window'], { tip: '🎨', why: 'introduce twins: same pouf, two colours, read the tint of the spot' }),
  L('Sofa time', 3, 0, ['sofa', 'coffee', E(3, 0, 'pouf', 'yellow'), 'lrug', E(3, 1, 'pouf', 'mint'), 'tvstand'], { why: 'practise twins with a bigger tray' }),
  L('First things first', 1, 1, ['counter', 'stove<counter', 'table', 'cake<table', 'stool', 'cat'], { tip: '🔒', why: 'introduce locks: taped stickers need their base first' }),
  L('Bubble bath', 2, 1, ['tub', 'duck<tub', 'bathrug', E(2, 0, 'pot', 'pink'), 'sink', 'mirror<sink', E(2, 1, 'pot', 'mint')], { why: 'locks + twins together' }),
  L('Cat nap', 0, 0, ['rug', 'cat<rug', 'desk', 'chair<desk', E(0, 0, 'pouf', 'lilac'), E(0, 1, 'pouf', 'coral'), 'bed'], { why: 'twist: two lock chains and a twin pair compete for the three tray slots' }),
  L('Lounge lizard', 3, 1, ['sofa', 'cushions<sofa', 'sofacat<sofa', 'lrug', 'coffee<lrug', 'floorlamp', 'tvstand', 'bookshelf'], { why: 'hard: a long chain of locks, plan the order' }),
  L('Housewarming', 1, 0, ['counter', 'stove<counter', 'table', 'cake<table', 'stool<table', 'fridge', E(1, 0, 'pot', 'pink'), E(1, 1, 'pot', 'blue'), 'rug', 'cat<rug', 'cabinets', 'mugs'], { boss: true, why: 'boss: 12 stickers, locks and twins in the biggest kitchen' }),
  // ---------------- WORLD 2 · Hush Hush — dust sheets (peek, remember)
  L('Peek-a-boo', 0, 1, ['bed', '~wardrobe', 'lamp', '~desk'], { tip: '👆', why: 'introduce dust sheets: tap one to peek for a moment' }),
  L('Under wraps', 1, 1, ['~fridge', '~table', 'counter', 'cake<table', 'stool', 'cat'], { why: 'sheets + a lock on a hidden base' }),
  L('Which is which', 3, 0, ['sofa', '~' + E(3, 0, 'pouf', 'pink'), '~' + E(3, 1, 'pouf', 'blue'), 'lrug', 'coffee'], { why: 'twins hidden under sheets: peek to read the tint' }),
  L('Soak', 2, 0, ['~tub', 'duck<tub', '~washer', 'sink', '~toilet', 'towels'], { why: 'three sheets, a lock on one of them' }),
  L('Memory lane', 0, 1, ['~bed', '~wardrobe', '~desk', '~rug', 'chair<desk', 'cat<rug'], { why: 'hard: four sheets, remember what you peeked' }),
  L('Tea party', 1, 0, ['table', 'cake<table', 'stool', 'mugs', 'cabinets', E(1, 0, 'pot', 'pink'), E(1, 1, 'pot', 'mint')], { why: 'breather: no sheets, pretty, chain-friendly' }),
  L('Dust bunnies', 3, 1, ['~bookshelf', '~tvstand', 'sofa', 'cushions<sofa', '~sofacat<sofa', 'lrug'], { why: 'sheets over wall furniture, locks on top' }),
  L('Doubles', 2, 1, ['~' + E(2, 0, 'pot', 'pink'), '~' + E(2, 1, 'pot', 'blue'), '~' + E(2, 2, 'pouf', 'pink'), '~' + E(2, 3, 'pouf', 'blue'), 'tub', 'duck<tub', 'sink'], { why: 'twist: two twin pairs, all hidden' }),
  L('Spring clean', 0, 0, ['~window', '~shelf', '~wardrobe', '~bed', '~desk', 'chair<desk', '~rug', 'cat<rug', 'lamp', 'plant'], { why: 'hard: ten stickers, six sheets' }),
  L('Grand reveal', 3, 0, ['~sofa', 'cushions<sofa', '~lrug', 'coffee<lrug', '~' + E(3, 0, 'pouf', 'coral'), '~' + E(3, 1, 'pouf', 'lilac'), 'tvstand', '~bookshelf', 'sofacat<sofa', 'floorlamp'], { boss: true, why: 'boss: sheets, locks and twins in the lounge' }),
  // ---------------- WORLD 3 · Party House — conveyor tray, rush, gifts and balloons
  L('Merry-go-round', 0, 1, ['bed', 'desk', 'wardrobe', 'lamp', 'plant'], { conv: 5, tip: '↻', why: 'introduce the turning tray: slow, easy room' }),
  L('Spin cycle', 2, 0, ['tub', 'duck<tub', 'sink', 'toilet', 'washer', 'bottles'], { conv: 4.5, why: 'turning tray with a lock' }),
  L('Tick tock', 1, 1, ['fridge', 'counter', 'stove<counter', 'table', 'cake<table', 'stool'], { rush: 55, tip: '⏱', why: 'introduce rush: guests arrive, generous clock' }),
  L('Balloons!', 3, 1, ['sofa', 'cushions<sofa', E(3, 0, 'balloon', 'pink'), E(3, 1, 'balloon', 'blue'), E(3, 2, 'balloon', 'yellow'), 'lrug'], { conv: 4, why: 'turning tray + three tinted balloons' }),
  L('Guests at the door', 0, 0, ['bed', 'rug', 'cat<rug', 'desk', 'chair<desk', E(0, 2, 'gift', 'pink'), E(0, 3, 'gift', 'blue')], { rush: 50, why: 'rush with locks and twins' }),
  L('Disco tray', 1, 0, ['~fridge', '~counter', 'stove<counter', '~table', 'cake<table', 'stool', E(1, 2, 'gift', 'pink'), E(1, 3, 'gift', 'mint')], { conv: 4.5, why: 'turning tray over sheets: peek fast' }),
  L('Double rush', 2, 1, ['tub', 'duck<tub', 'bathrug', 'sink', E(2, 0, 'pot', 'pink'), E(2, 1, 'pot', 'mint'), E(2, 2, 'gift', 'blue'), E(2, 3, 'gift', 'yellow')], { rush: 50, why: 'hard: eight stickers on a clock with two twin pairs' }),
  L('Spin and rush', 3, 0, ['sofa', 'cushions<sofa', 'sofacat<sofa', 'lrug', 'coffee<lrug', 'tvstand', E(3, 0, 'balloon', 'coral'), E(3, 1, 'balloon', 'lilac'), 'floorlamp', 'bookshelf'], { conv: 4.5, rush: 75, why: 'hard: turning tray and a clock together' }),
  L('Confetti room', 0, 1, [E(0, 0, 'balloon', 'pink'), 'bed', E(0, 1, 'balloon', 'yellow'), 'rug', E(0, 2, 'gift', 'mint'), 'desk', E(0, 3, 'balloon', 'blue'), 'wardrobe', E(0, 4, 'gift', 'lilac'), 'window', 'lamp', 'plant'], { why: 'breather: 12 easy stickers, a chain-and-fever party' }),
  L('Grand party', 1, 1, ['~fridge', 'counter', 'stove<counter', '~table', 'cake<table', 'stool<table', E(1, 0, 'balloon', 'pink'), E(1, 1, 'balloon', 'blue'), E(1, 2, 'gift', 'mint'), E(1, 3, 'gift', 'coral'), '~cabinets', 'rug', 'cat<rug', 'mugs'], { boss: true, conv: 4.5, rush: 110, why: 'boss: every mechanic at once, 14 stickers' }),
];
export const WORLDS = [{ name: 'Cosy Flat', icon: '🏠', from: 1 }, { name: 'Hush Hush', icon: '🫧', from: 11 }, { name: 'Party House', icon: '🎈', from: 21 }];
export const EMOJI = ['🧸', '🪴', '🛁', '🛏️', '🛋️', '🍰', '🦆', '🐈', '🕯️', '🎁', '🫧', '🧺', '🔍', '🪞', '🧦', '🍵', '🧹', '🎨', '🏺', '📜', '🎠', '🫧', '⏰', '🎈', '🎉', '🪩', '🧁', '🌀', '🎊', '👑'];

export function finish(lv) {            // expand tokens → stickers, par
  const st = lv.st.map(t => parse(t, lv.th));
  const par = lv.par || Math.round(st.length * 2.0 + 3 + (st.filter(s => s.sheet).length) * 1.0);
  return { ...lv, stickers: st, par };
}
// deadlock check (no turning tray): the tray shows the first 3 left; from every reachable state at least one visible sticker must be free
export function deadlockFree(lv) {
  const st = lv.stickers || lv.st.map(t => parse(t, lv.th)), n = st.length, ids = st.map(s => s.id), seen = new Map();
  const free = (i, done) => { const l = st[i].lock; if (!l) return true; const j = ids.indexOf(l); return j < 0 ? true : !!(done >> j & 1); };
  const go = done => {
    if (done === (1 << n) - 1) return true;
    if (seen.has(done)) return seen.get(done);
    const vis = []; for (let i = 0; i < n && vis.length < 3; i++) if (!(done >> i & 1)) vis.push(i);
    seen.set(done, false);
    const moves = vis.filter(i => free(i, done)); let ok = moves.length > 0;
    if (ok) for (const i of moves) if (!go(done | 1 << i)) ok = false;
    seen.set(done, ok); return ok;
  };
  if (lv.conv) return true;
  return go(0);
}
// seeded generator for the daily room and endless rooms after 30
export function gen(seed, tier = 3) {
  let s = Math.floor(seed) % 2147483647 || 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(r() * a.length)];
  const LOCKS = [{ k: 'stove', b: 'counter' }, { k: 'cake', b: 'table' }, { k: 'stool', b: 'table' }, { k: 'duck', b: 'tub' }, { k: 'mirror', b: 'sink' }, { k: 'cat', b: 'rug' }, { k: 'chair', b: 'desk' }, { k: 'cushions', b: 'sofa' }, { k: 'sofacat', b: 'sofa' }, { k: 'coffee', b: 'lrug' }];
  for (let tries = 0; tries < 60; tries++) {
    const th = Math.floor(r() * 4), look = Math.floor(r() * 2), items = THEME_ITEMS[th], n = 7 + Math.floor(r() * 5);
    const keys = items.slice().sort(() => r() - 0.5).slice(0, Math.min(items.length, n - 2));
    let toks = keys.map(k => k);
    toks = toks.map(k => { const l = LOCKS.find(x => x.k === k && keys.includes(x.b)); return l && r() < 0.8 ? `${k}<${l.b}` : k; });
    const kinds = ['pouf', 'pot', 'gift', 'balloon'], tints = Object.keys(TINT).sort(() => r() - 0.5), sp = SPOTS[th].slice().sort(() => r() - 0.5);
    const ek = pick(kinds); toks.push(`${ek}@${sp[0][0]},${sp[0][1]},${tints[0]}`, `${ek}@${sp[1][0]},${sp[1][1]},${tints[1]}`);
    if (tier >= 2) toks = toks.map(t => r() < 0.22 ? '~' + t : t);
    toks = toks.sort(() => r() - 0.5);
    const lv = { name: 'Daily room', th, look, st: toks, why: 'generated' };
    if (tier >= 3 && r() < 0.4) lv.conv = 4.5; else if (tier >= 3 && r() < 0.4) lv.rush = Math.round(toks.length * 6.5);
    const f = finish(lv); if (deadlockFree(f)) return f;
  }
  return finish(L('Cosy corner', 0, 0, ['bed', 'lamp', 'plant']));
}

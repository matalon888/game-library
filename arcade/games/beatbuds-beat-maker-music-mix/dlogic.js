// Beatbuds deep v2 — the gig rules, shared by the game and the node checker (qa/verify.mjs). Our own code.
// A gig asks the band for a crowd mood: chips (goals) that tick live as the buds are set. All chips = 1 star, the gold
// bonus chips as well = 2 stars, and the gig's hidden combo on stage too = 3 stars.
export const CATS = [
  { n: 'Beats', c: '#ff8a3d', ids: ['thump', 'bap', 'floor', 'shaker', 'mouth'], ic: ['🥁', '👟', '💥', '🫧', '👄'] },
  { n: 'Effects', c: '#2ec27e', ids: ['bass', 'wobble', 'claps', 'riser', 'bleeps'], ic: ['🎸', '🌀', '👏', '🚀', '📡'] },
  { n: 'Melodies', c: '#3d8bff', ids: ['arp', 'bells', 'pad', 'whistle', 'marimba'], ic: ['🎹', '🔔', '☁️', '🐦', '🪵'] },
  { n: 'Voices', c: '#ff5fa2', ids: ['ooh', 'doo', 'la', 'hey', 'hum'], ic: ['😮', '🎩', '🎤', '🙌', '🎵'] },
];
export const CATICON = ['🥁', '✨', '🎹', '🎤'];
// hype (energy) and feel (warmth), 0-3 each
const HF = { thump: [2, 0], bap: [3, 0], floor: [3, 1], shaker: [1, 1], mouth: [2, 1], bass: [2, 1], wobble: [3, 0], claps: [2, 1], riser: [3, 0], bleeps: [1, 1],
  arp: [1, 2], bells: [0, 3], pad: [0, 3], whistle: [1, 2], marimba: [2, 2], ooh: [0, 3], doo: [1, 2], la: [1, 3], hey: [3, 1], hum: [0, 2] };
export const SND = {}; CATS.forEach((c, ci) => c.ids.forEach((id, i) => SND[id] = { id, cat: ci, ic: c.ic[i], c: c.c, k: ci * 5 + i, h: HF[id][0], f: HF[id][1] }));
export const ALL = Object.keys(SND);

/** chips: ['cat',c,n] at least n from category c · ['exact',c,n] exactly n · ['id',x] · ['bancat',c] · ['banid',x] ·
 *  ['hype',n] · ['feel',n] · ['cool',n] hype at most n · ['fill'] every bud has a sound */
export function chipOk(g, ch, slots) {
  const ids = slots.filter(Boolean), cnt = c => ids.filter(x => SND[x].cat === c).length;
  const t = totals(g, slots);
  switch (ch[0]) {
    case 'cat': return cnt(ch[1]) >= ch[2];
    case 'exact': return cnt(ch[1]) === ch[2];
    case 'id': return ids.includes(ch[1]);
    case 'bancat': return cnt(ch[1]) === 0;
    case 'banid': return !ids.includes(ch[1]);
    case 'hype': return t.hype >= ch[1];
    case 'feel': return t.feel >= ch[1];
    case 'cool': return t.hype <= ch[1];
    case 'fill': return ids.length === g.slots;
  }
  return false;
}
/** the spotlight bud (g.star = its index, -1 none) doubles its sound's hype and feel */
export function totals(g, slots) {
  let hype = 0, feel = 0;
  slots.forEach((id, i) => { if (!id) return; const k = i === g.star ? 2 : 1; hype += SND[id].h * k; feel += SND[id].f * k; });
  return { hype, feel };
}
export function evalGig(g, slots) {
  if (g.jam) return { ok: [], bonus: [], hid: 0, hype: totals(g, slots).hype, feel: totals(g, slots).feel, stars: 0 };
  const ok = g.chips.map(c => chipOk(g, c, slots)), bonus = (g.bonus || []).map(c => chipOk(g, c, slots));
  const hid = g.hidden.filter(x => slots.includes(x)).length;
  const t = totals(g, slots), main = ok.every(Boolean), both = main && bonus.every(Boolean);
  const stars = !main ? 0 : !both ? 1 : hid === g.hidden.length ? 3 : 2;
  return { ok, bonus, hid, hype: t.hype, feel: t.feel, stars };
}
/** try every set of sounds (and which one stands in the spotlight): best stars, fewest placements per star level */
export function solve(g) {
  const pool = ALL.filter(x => !(g.lock || []).includes(x)), n = g.slots, best = { 1: 99, 2: 99, 3: 99 }, cnt = { 1: 0, 2: 0, 3: 0 }, ex = { 1: null, 2: null, 3: null };
  const pick = [];
  const test = () => {
    const k = pick.length, tries = [];
    if (g.star < 0 || g.star >= n) { const s = new Array(n).fill(null); pick.forEach((x, i) => s[i] = x); tries.push(s); }
    else {
      if (k < n) { const s = new Array(n).fill(null); let j = 0; pick.forEach(x => { if (j === g.star) j++; s[j++] = x; }); tries.push(s); }
      for (let a = 0; a < k; a++) { const s = new Array(n).fill(null); s[g.star] = pick[a]; let j = 0; pick.forEach((x, i) => { if (i === a) return; if (j === g.star) j++; s[j++] = x; }); if (j <= n) tries.push(s); }
    }
    let top = 0; for (const s of tries) { const r = evalGig(g, s).stars; if (r > top) top = r; }
    for (let st = 1; st <= top; st++) { cnt[st]++; if (k < best[st]) { best[st] = k; ex[st] = pick.slice(); } }
  };
  const rec = (from) => { if (pick.length) test(); if (pick.length === n) return; for (let i = from; i < pool.length; i++) { pick.push(pool[i]); rec(i + 1); pick.pop(); } };
  rec(0);
  return { min: best, count: cnt, example: ex };
}
/** a generated gig for the encore (after gig 30) and the daily: pick a hidden combo, derive goals it can meet */
export function genGig(seed, level = 31) {
  let s = (seed * 7919 + level * 104729) % 2147483647 || 1; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4; i++) R();
  const nh = 3 + (R() < 0.4 ? 1 : 0), slots = nh + 1 + (R() < 0.5 ? 1 : 0), star = R() < 0.6 ? Math.floor(R() * slots) : -1;
  const pool = ALL.slice(), hidden = []; while (hidden.length < nh) hidden.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  const g = { slots, star, hidden, chips: [], bonus: [], takes: slots + 3, lock: [] };
  const filler = pool.filter(x => true);
  const full = hidden.slice(); const t = (set) => { const sl = new Array(slots).fill(null); set.forEach((x, i) => sl[i] = x); return totals(g, sl); };
  // best placement of the hidden set: put its strongest sound in the spotlight
  const cats = [0, 1, 2, 3].map(c => hidden.filter(x => SND[x].cat === c).length);
  const hs = hidden.reduce((a, x) => [a[0] + SND[x].h, a[1] + SND[x].f], [0, 0]);
  const bestStar = star >= 0 ? Math.max(...hidden.map(x => SND[x].h + SND[x].f)) : 0;
  const hh = hs[0] + (star >= 0 ? hidden.map(x => SND[x].h).sort((a, b) => b - a)[0] : 0), ff = hs[1] + (star >= 0 ? hidden.map(x => SND[x].f).sort((a, b) => b - a)[0] : 0);
  const want = [];
  const missing = [0, 1, 2, 3].filter(c => !cats[c]);
  if (missing.length && R() < 0.7) want.push(['bancat', missing[Math.floor(R() * missing.length)]]);
  const present = [0, 1, 2, 3].filter(c => cats[c]); const pc = present[Math.floor(R() * present.length)]; want.push(['cat', pc, Math.max(1, cats[pc] - (R() < 0.3 ? 1 : 0))]);
  want.push(['hype', Math.max(2, hh - 1 - Math.floor(R() * 2))]);
  want.push(['feel', Math.max(2, ff - 1 - Math.floor(R() * 2))]);
  g.chips = want; g.bonus = [R() < 0.5 ? ['hype', hh] : ['feel', ff]];
  g.n = 'Encore ' + (level - 30); g.clue = 'a secret set hides here'; g.why = 'generated encore'; g.w = 3;
  void filler; void full; void t; void bestStar;
  return g;
}

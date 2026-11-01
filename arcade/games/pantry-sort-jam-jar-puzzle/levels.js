// Pantry Sort v2: 30 hand-made shelves in 3 worlds. Each jar is written bottom to top: s strawberry, b blueberry, a apricot,
// l lemon, p plum, i lime. "." is an empty jar. A leading L is a wax seal that melts after the first finished jam, LL after
// two; a leading M is a cloth jar: only its top fruit shows until you pour it off. Every level is proven solvable by qa/check37.mjs.
import { KINDS } from './logic.js';
const CH = { s: 'strawberry', b: 'blueberry', a: 'apricot', l: 'lemon', p: 'plum', i: 'lime', r: 'rhubarb', h: 'honey' };
export const WORLDS = [
  { id: 1, name: "Nana's Shelf", sub: 'Pour, match, make jam' },
  { id: 2, name: 'The Cellar', sub: 'Wax seals hold the jars shut' },
  { id: 3, name: 'Market Day', sub: 'Cloth-covered jars hide their fruit' },
];
const R = (n, jars, why, extra = {}) => ({ n, jars, why, ...extra });
export const LEVELS = [
  R(1, 'sssb bbbs . .', 'Two pours and you are done'),
  R(2, 'sssb bbbl llls . .', 'A little ring: break it with the empty jar'),
  R(3, 'sbsb blbl lsls . .', 'Mixed up, but two spare jars is plenty'),
  R(4, 'sbls bsll lbsb . .', 'Think one pour ahead'),
  R(5, 'sbla albs bsal lasb . .', 'Four fruits in every jar'),
  R(6, 'sssa aaab bbbl llls . .', 'Breather: one pour sets off a chain of jams', { breather: 1 }),
  R(7, 'pbsl salb lpas bapl abps . .', 'Five fruits, five jars, look before you pour'),
  R(8, 'slab bpal psla abps lsbp .', 'Hard: only one spare jar', { hard: 1 }),
  R(9, 'sssb bbbl lllp pppa aaas .', 'Breather: a ring of five, and one empty jar', { breather: 1 }),
  R(10, 'lbas pabl iasl ipba pils bsip . .', 'Shelf boss: six jams to make', { boss: 1 }),
  R(11, 'sssb bbbl Lllls . .', 'New: a wax seal. Make one jam and it melts', { fresh: 'seal' }),
  R(12, 'bsbl lbsb Lllss . .', 'The sealed jar needs a jam first: make blueberry'),
  R(13, 'asal alas Lsbsb Llblb . .', 'Two sealed jars, one melt'),
  R(14, 'sssa aaab bbbl Lllls . .', 'Breather: the sealed jar is the last domino', { breather: 1 }),
  R(15, 'alal lala sbbs LLsbsb . .', 'A double seal: it needs two jams', { fresh: 'seal2' }),
  R(16, 'alas lbal slab Lsbsb . .', 'Hard: the first jam has to come from the right jars', { hard: 1 }),
  R(17, 'alpa lpal palp Lsbsb Lbsbs . .', 'Two seals among five'),
  R(18, 'sssb bbbl lllp pppa Laaas . .', 'Breather: the seal is the last domino', { breather: 1 }),
  R(19, 'alpi ilap pila lpai Lsbsb Lbsbs . .', 'Six jams, two seals'),
  R(20, 'ipla pali lapi aipl Lbsbs LLsbsb . .', 'Cellar boss: a double seal on six', { boss: 1 }),
  R(21, 'Msssb bbbs . .', 'New: a cloth jar. Only the top fruit shows', { fresh: 'cloth' }),
  R(22, 'Msbsb blbl Mlsls . .', 'Pour the top off and see what is under'),
  R(23, 'Msbls Mbsll lbsb . .', 'Remember what you uncover'),
  R(24, 'Msssp Mpppa Maaab bbbl llls . .', 'Breather: a ring of five under cloth', { breather: 1 }),
  R(25, 'Masal Malas Lsbsb Llblb . .', 'Cloth and wax together'),
  R(26, 'Msbla Malbs Mbsal lasb .', 'Hard: three cloths, one spare jar', { hard: 1 }),
  R(27, 'Malpa Mlpal Mpalp Lsbsb LLbsbs . .', 'Cloth, seals, five jams'),
  R(28, 'Mlbas Mpabl Miasl Mipba Mpils Mbsip . .', 'Six cloths: trust what you uncover'),
  R(29, 'sssb bbbl lllp pppa aaai iiis . .', 'Breather: the grand cascade', { breather: 1 }),
  R(30, 'Malpi Milap Mpila Mlpai Lsbsb LLbsbs . .', 'Market boss: every trick at once', { boss: 1 }),
];
export const worldOf = n => Math.min(2, Math.floor((n - 1) / 10));
/** parse a level: jars (arrays bottom to top), seals (Map jar index -> jams needed), cloth (Set of jar indexes) */
export function parseLevel(def) {
  const jars = [], seals = new Map(), cloth = new Set();
  def.jars.split(' ').forEach((tok, i) => {
    let t = tok, m;
    if ((m = /^(L+)/.exec(t))) { seals.set(i, m[1].length); t = t.slice(m[1].length); }
    if (t[0] === 'M') { cloth.add(i); t = t.slice(1); }
    jars.push(t === '.' ? [] : [...t].map(c => CH[c]));
  });
  const kinds = KINDS.filter(k => jars.some(j => j.includes(k)));
  return { n: def.n, jars, seals, cloth, kinds, why: def.why, hard: !!def.hard, boss: !!def.boss, breather: !!def.breather, fresh: def.fresh || null, easy: def.n <= 5, daily: false, authored: true };
}

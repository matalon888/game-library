// Pastel Pixel picture library: 8 hand-authored starter pictures + 61 pixel maps built from our kawaii library props
// (tools/build-pics.cjs → pics-props.js). A picture = { id, name, pack, w, h, pal:[hex], px: 'ab..' } where px has one
// char per cell: '.' = empty, 'a' = colour 1, 'b' = colour 2 …
import { PROP_PICS } from './pics-props.js';

const OUT = '#7b5aa6';
// hand-made starters (no outline in the source: added below so they match the library look)
const HAND = [
  { id: 'heart', name: 'Happy Heart', pal: ['#ff79b8', '#ffd3e6', '#4b2a6e', '#ffb3d6'], map: `
.aaa....aaa.
aaaaa..aaaaa
abbaaaaaaaaa
abaaaaaaaaaa
aaacaaaacaaa
aadaaccaadaa
.aaaaaaaaaa.
..aaaaaaaa..
...aaaaaa...
....aaaa....
.....aa.....` },
  { id: 'berry', name: 'Berry Cute', pal: ['#ff5c8a', '#7fd98a', '#ffe27a', '#4b2a6e', '#ffb3c8'], map: `
....bbbb....
...bb..bb...
.aaabbbbaaa.
aaaaaaaaaaaa
acaaaaaaacaa
aaadaaaadaaa
aaeaaddaaeaa
aaaaaaaaaaaa
.acaaaaaaca.
..aaaaaaaa..
...aacaaa...
....aaaa....` },
  { id: 'boba', name: 'Boba Buddy', pal: ['#f3c9a0', '#b58cff', '#4b2a6e', '#ff79b8', '#ffd3e6'], map: `
.......d....
......d.....
..bbbbdbbb..
.bbbbbbbbbb.
..aaaaaaaa..
..aaaaaaaa..
..acaaaaca..
..aeaccaea..
..aaaaaaaa..
...acaaca...
...cacacc...
...aaaaaa...
....cccc....` },
  { id: 'kitty', name: 'Lilac Kitty', pal: ['#c9b3ff', '#ffb3d6', '#4b2a6e', '#ff79b8'], map: `
.a.........a.
.aa.......aa.
.aba.....aba.
.aaaaaaaaaaa.
aaaaaaaaaaaaa
aaacaaaaacaaa
aaccaaaaaccaa
abaaaadaaaaba
aaaaaaaaaaaaa
.aaaaaaaaaaa.
...aaaaaaa...` },
  { id: 'ghost', name: 'Boo Bestie', pal: ['#e3f3ff', '#4b2a6e', '#ff9ec0', '#ff79b8'], map: `
...aaaaa...
..aaaaaaa..
.aaaaaaaaa.
.aabaaabaa.
.aabaaabaa.
.acaaaaaca.
aaaaadaaaaa
aaaaaaaaaaa
aaaaaaaaaaa
aaaaaaaaaaa
aa.aaa.aaa.
a...a...a..` },
  { id: 'onigiri', name: 'Rice Pal', pal: ['#fff6fb', '#3d4a5c', '#4b2a6e', '#ff9ec0'], map: `
.....aa.....
....aaaa....
...aaaaaa...
..aaaaaaaa..
..acaaaaca..
.adaaccaada.
.aaaaaaaaaa.
aaabbbbbbaaa
aabbbbbbbbaa
abbbbbbbbbba
aabbbbbbbbaa` },
  { id: 'shroom', name: 'Shroomie', pal: ['#ff6b9a', '#ffffff', '#fff1d6', '#4b2a6e', '#ff9ec0'], map: `
....aaaa....
..aabbaaaa..
.aaabbaaaaa.
aaaaaaaabbaa
abbaaaaabbaa
aabbaaaaaaaa
.aaaaaaaaaa.
....cccc....
...cdccdc...
...ceeeec...
...cccccc...
....cccc....` },
  { id: 'star', name: 'Star Baby', pal: ['#ffd24d', '#4b2a6e', '#ffb3a0', '#ff79b8'], map: `
......a......
.....aaa.....
.....aaa.....
aaaaaaaaaaaaa
.aaaaaaaaaaa.
..aabaaabaa..
...acaaaca...
...aaadaaa...
..aaaaaaaaa..
..aaaa.aaaa..
.aaa.....aaa.
.a.........a.` },
];
function fromMap(h) {
  const rows = h.map.trim().split('\n'), w = Math.max(...rows.map(r => r.length));
  const W = w + 2, H = rows.length + 2, g = Array(W * H).fill('.');
  rows.forEach((r, y) => [...r.padEnd(w, '.')].forEach((c, x) => g[(y + 1) * W + x + 1] = c));
  const oc = String.fromCharCode(97 + h.pal.length);
  const fill = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y * W + x] !== '.' && g[y * W + x] !== oc;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y * W + x] === '.' && (fill(x + 1, y) || fill(x - 1, y) || fill(x, y + 1) || fill(x, y - 1))) g[y * W + x] = oc;
  return { id: h.id, name: h.name, pack: 'starter', w: W, h: H, pal: [...h.pal, OUT], px: g.join('') };
}
const NAMES = {
  t03: 'Berry Bestie', t06: 'Cherry Twins', t09: 'Heart Pop', t05: 'Sprinkle Donut', t02: 'Mochi Moon', t07: 'Peachy Keen', t01: 'Boba Time',
  t08: 'Soft Serve', g08: 'Macaron Stack', g09: 'Cupcake Cutie', f05: 'Onigiri Pal', f01: 'Dumpling Dream', f02: 'Bao Bun', g11: 'Shortcake',
  f08: 'Pancake Tower', g12: 'Party Cake', c03: 'Froggy Bun', c04: 'Chick Bun', c01: 'Bunny Bun', c02: 'Bear Bun', c05: 'Kitty Bun',
  c06: 'Fox Bun', p04: 'Bun Bun', p03: 'Hammy', p01: 'Kitten Mittens', p02: 'Puppy Love', p06: 'Corgi Loaf', p05: 'Axolotl Smile',
  g01: 'Lip Balm', g02: 'Lipstick Duo', g04: 'Heart Perfume', b01: 'Satin Bow', w09: 'Heart Shades', g03: 'Polish Pair', w05: 'Heart Bag',
  w07: 'Cat-Ear Headphones', w04: 'Platform Boots', g05: 'Glow Palette', w01: 'Sequin Top', w08: 'Ruffle Dress', g06: 'Vanity Case',
  m01: 'Heart Jelly', m03: 'Twinkle Star', m06: 'Cloud Nap', j01: 'Jelly Cube', x05: 'Rainbow', h07: 'Succulent', h06: 'Mushroom Lamp',
  m08: 'Rainbow Ball', x01: 'Treasure Chest', r05: 'Rose Bouquet', h02: 'Beanbag', r01: 'Blossom Tree', h12: 'Cat Tree', h01: 'Dream Bed',
  k07: 'Lulu', k05: 'Sunny', k01: 'Momo', k02: 'Bea', k03: 'Zuri', k04: 'Kiki',
};
export const PACKS = [
  { id: 'starter', name: 'First Pixels', need: 0, icon: 'm01' },
  { id: 'sweet', name: 'Sweet Treats', need: 3, icon: 't01' },
  { id: 'pets', name: 'Pet Pals', need: 8, icon: 'p01' },
  { id: 'glow', name: 'Glow Up', need: 14, icon: 'g04' },
  { id: 'room', name: 'Dream Room', need: 20, icon: 'h06' },
  { id: 'friends', name: 'Club Friends', need: 28, icon: 'k07' },
];
export const PICS = [...HAND.map(fromMap), ...PROP_PICS.map(p => ({ ...p, name: NAMES[p.id] || p.id }))];
PICS.forEach(p => { p.cells = [...p.px].filter(c => c !== '.').length; p.size = p.cells < 160 ? 'Small' : p.cells < 520 ? 'Medium' : 'Big'; });
export const byId = Object.fromEntries(PICS.map(p => [p.id, p]));

// daily picture: the same for everyone today, from the medium library pictures
export const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const fromNum = n => new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100, 12);
export const addDays = (n, k) => { const d = fromNum(n); d.setDate(d.getDate() + k); return dayNum(d); };
const EPOCH = Date.UTC(2026, 0, 1);
export const setNo = n => { const d = fromNum(n); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5) + 1; };
export function dailyPic(n) {
  const pool = PICS.filter(p => p.pack !== 'starter' && p.pack !== 'friends' && p.size !== 'Big');
  let h = 2166136261; for (const c of 'pp' + setNo(n)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length];
}

// Glowfit Runway data: style tags, colourways, wardrobe pieces, themed briefs, scoring, the simulated vote, stickers,
// studio decor. Same rules for the player and the rival models (no hidden bonuses).

export const TAGS = {
  cute: ['🎀', 'Cute'], y2k: ['💿', 'Y2K'], cozy: ['☁️', 'Cozy'], glam: ['💎', 'Glam'], dreamy: ['🦄', 'Dreamy'],
  sweet: ['🍓', 'Sweet'], street: ['🛹', 'Street'], preppy: ['📚', 'Preppy'], party: ['🎉', 'Party'], picnic: ['🧺', 'Picnic'],
};

// colourways: hue-swap targets (h 0..1, s/v multipliers). fam = colour family for harmony scoring.
export const COLOURS = [
  { id: 'orig', name: 'Original', fam: null, css: 'conic-gradient(#ff9ccf,#c9a6ff,#9ff0d2,#ffe58f,#ff9ccf)', amt: 0, lvl: 1 },
  { id: 'berry', name: 'Strawberry', fam: 'berry', css: '#ff7fb6', h: 0.93, s: 1.15, v: 1.02, lvl: 1 },
  { id: 'lilac', name: 'Lilac', fam: 'lilac', css: '#b98cff', h: 0.76, s: 1.05, v: 1, lvl: 1 },
  { id: 'mint', name: 'Mint', fam: 'mint', css: '#6fe0b8', h: 0.43, s: 1.0, v: 1.02, lvl: 2 },
  { id: 'butter', name: 'Butter', fam: 'butter', css: '#ffd86b', h: 0.135, s: 1.15, v: 1.08, lvl: 3 },
  { id: 'sky', name: 'Sky', fam: 'sky', css: '#7cc6ff', h: 0.575, s: 1.05, v: 1.02, lvl: 4 },
  { id: 'peach', name: 'Peach', fam: 'peach', css: '#ffab85', h: 0.045, s: 1.05, v: 1.04, lvl: 6 },
  { id: 'cherry', name: 'Cherry', fam: 'cherry', css: '#ff3b6b', h: 0.97, s: 1.7, v: 0.92, lvl: 8 },
  { id: 'noir', name: 'Noir', fam: 'noir', css: '#3a3046', h: 0.78, s: 0.35, v: 0.42, lvl: 10 },
];
export const FAMS = { berry: '#ff7fb6', lilac: '#b98cff', mint: '#6fe0b8', butter: '#ffd86b', sky: '#7cc6ff', peach: '#ffab85', cherry: '#ff3b6b', noir: '#3a3046' };
export const colourById = id => COLOURS.find(c => c.id === id) || COLOURS[0];

// slots in the order of the tab bar (mockup B1 bottom bar)
export const SLOTS = [
  { key: 'top', icon: 'top', name: 'Tops' },
  { key: 'bottom', icon: 'skirt', name: 'Skirts' },
  { key: 'shoes', icon: 'boot', name: 'Shoes' },
  { key: 'bag', icon: 'bag', name: 'Bags' },
  { key: 'head', icon: 'bow', name: 'Hair' },
  { key: 'face', icon: 'shades', name: 'Glam' },
  { key: 'hand', icon: 'wand', name: 'Hold' },
];

// wardrobe pieces. base = colour family of the original texture. lvl = show it unlocks at; coins = boutique price
export const PIECES = [
  { id: 'w01', slot: 'top', name: 'Sequin Crop', tags: ['y2k', 'glam', 'party'], base: 'berry', lvl: 1 },
  { id: 'w08', slot: 'top', name: 'Ruffle Dress', tags: ['dreamy', 'cute', 'sweet'], base: 'lilac', lvl: 1, dress: true },
  { id: 'w02', slot: 'top', name: 'Puffer Jacket', tags: ['cozy', 'street', 'y2k'], base: 'mint', lvl: 3 },
  { id: 'w03', slot: 'bottom', name: 'Chain Pleats', tags: ['y2k', 'preppy', 'street'], base: 'lilac', lvl: 1 },
  { id: 'tutu', slot: 'bottom', name: 'Tulle Tutu', tags: ['dreamy', 'party', 'cute'], base: 'berry', lvl: 2, code: true },
  { id: 'w04', slot: 'shoes', name: 'Platform Boots', tags: ['y2k', 'street', 'glam'], base: 'lilac', lvl: 1 },
  { id: 'w05', slot: 'bag', name: 'Heart Bag', tags: ['cute', 'glam', 'sweet'], base: 'berry', lvl: 1 },
  { id: 'w07', slot: 'head', name: 'Kitty Phones', tags: ['y2k', 'cute', 'street'], base: 'berry', lvl: 1 },
  { id: 'b01', slot: 'head', name: 'Satin Bow', tags: ['sweet', 'cute', 'preppy'], base: 'berry', lvl: 2 },
  { id: 'w06', slot: 'head', name: 'Beret', tags: ['preppy', 'cozy', 'dreamy'], base: 'lilac', lvl: 4 },
  { id: 'w09', slot: 'face', name: 'Heart Shades', tags: ['y2k', 'glam', 'picnic'], base: 'berry', lvl: 1 },
  { id: 'b02', slot: 'face', name: 'Star Clip', tags: ['cute', 'y2k', 'party'], base: 'berry', lvl: 3 },
  { id: 't01', slot: 'hand', name: 'Boba Cup', tags: ['cozy', 'picnic', 'street'], base: 'lilac', lvl: 1 },
  { id: 'r05', slot: 'hand', name: 'Bouquet', tags: ['dreamy', 'picnic', 'sweet'], base: 'berry', lvl: 2 },
  { id: 't09', slot: 'hand', name: 'Lollipop', tags: ['sweet', 'party', 'cute'], base: 'berry', lvl: 5 },
  { id: 'x04', slot: 'hand', name: 'Star Wand', tags: ['party', 'dreamy', 'glam'], base: 'butter', lvl: 7 },
];
export const pieceById = id => PIECES.find(p => p.id === id);
// a few colourways are boutique-only (coins) — sold, never required: every show is winnable with free pieces
export const BOUTIQUE = [
  { id: 'w08:noir', price: 120 }, { id: 'w01:cherry', price: 90 }, { id: 'w04:noir', price: 90 }, { id: 'w02:butter', price: 80 },
  { id: 'w05:mint', price: 60 }, { id: 'w03:sky', price: 60 }, { id: 'tutu:butter', price: 70 }, { id: 'w07:noir', price: 80 },
  { id: 'w06:cherry', price: 70 }, { id: 'x04:lilac', price: 60 },
];

// themed briefs: want 2 tags, a palette of colour families, (from show 6) maybe a tag to avoid
export const THEMES = [
  { id: 'y2kpicnic', name: 'Y2K Picnic', emoji: '🧺', want: ['y2k', 'picnic'], pal: ['berry', 'butter', 'mint'], lvl: 1, line: 'Sunshine, strawberries and shiny 2003 energy.' },
  { id: 'campus', name: 'Cozy Campus', emoji: '📚', want: ['cozy', 'preppy'], pal: ['lilac', 'peach', 'butter'], lvl: 2, line: 'First lecture at 9. Look soft, look smart.' },
  { id: 'fairy', name: 'Fairy Garden', emoji: '🧚', want: ['dreamy', 'cute'], pal: ['mint', 'lilac', 'butter'], lvl: 3, line: 'Sparkle like dew on a petal.' },
  { id: 'soiree', name: 'Sweetheart Soirée', emoji: '💘', want: ['sweet', 'glam'], pal: ['berry', 'cherry', 'lilac'], lvl: 4, line: 'Heart-eyes only. Dress to be adored.' },
  { id: 'arcade', name: 'Arcade Night', emoji: '🕹️', want: ['y2k', 'street'], pal: ['sky', 'lilac', 'berry'], lvl: 5, line: 'High score in your highest platforms.' },
  { id: 'boba', name: 'Boba Date', emoji: '🧋', want: ['cozy', 'sweet'], pal: ['peach', 'berry', 'lilac'], lvl: 6, line: 'Extra pearls, extra cute.' },
  { id: 'popstar', name: 'Pop Star Debut', emoji: '🎤', want: ['party', 'glam'], pal: ['lilac', 'cherry', 'sky'], lvl: 7, line: 'Your first stage. Make them scream.' },
  { id: 'strawfest', name: 'Strawberry Fest', emoji: '🍓', want: ['sweet', 'picnic'], pal: ['berry', 'cherry', 'mint'], lvl: 8, line: 'Berry pink, leafy mint, all smiles.' },
  { id: 'rainy', name: 'Rainy Day Café', emoji: '☔', want: ['cozy', 'cute'], pal: ['sky', 'lilac', 'noir'], lvl: 9, line: 'Puddles outside, cocoa inside.' },
  { id: 'mall', name: 'Mall Hangout 2003', emoji: '🛍️', want: ['y2k', 'glam'], pal: ['berry', 'sky', 'butter'], lvl: 10, line: 'Food court runway. Flip phone optional.' },
  { id: 'skate', name: 'Skate Park', emoji: '🛹', want: ['street', 'cozy'], pal: ['mint', 'noir', 'butter'], lvl: 11, line: 'Kickflips and comfy layers.' },
  { id: 'prom', name: 'Moonlight Prom', emoji: '🌙', want: ['dreamy', 'glam'], pal: ['lilac', 'sky', 'noir'], lvl: 12, line: 'Slow dance under paper stars.' },
  { id: 'library', name: 'Library Crush', emoji: '💌', want: ['preppy', 'sweet'], pal: ['peach', 'cherry', 'butter'], lvl: 13, line: 'Shhh… but make it cute.' },
  { id: 'unicorn', name: 'Unicorn Rave', emoji: '🦄', want: ['party', 'dreamy'], pal: ['lilac', 'mint', 'berry'], lvl: 14, line: 'Glitter is a personality.' },
  { id: 'bonfire', name: 'Beach Bonfire', emoji: '🏖️', want: ['picnic', 'party'], pal: ['butter', 'peach', 'sky'], lvl: 15, line: 'Sunset, s’mores, sandy sparkle.' },
  { id: 'snow', name: 'Snow Day Cocoa', emoji: '☃️', want: ['cozy', 'cute'], pal: ['sky', 'lilac', 'berry'], lvl: 16, line: 'Marshmallow puffy, rosy cheeks.' },
  { id: 'matcha', name: 'Matcha Morning', emoji: '🍵', want: ['cozy', 'picnic'], pal: ['mint', 'butter', 'peach'], lvl: 17, line: 'Slow sip, soft greens.' },
  { id: 'cyber', name: 'Cyber Kitty', emoji: '😼', want: ['street', 'cute'], pal: ['noir', 'cherry', 'lilac'], lvl: 18, line: 'Neon whiskers, black platforms.' },
  { id: 'teaparty', name: 'Garden Tea Party', emoji: '🫖', want: ['preppy', 'dreamy'], pal: ['berry', 'mint', 'lilac'], lvl: 19, line: 'Pinkies up, petals everywhere.' },
  { id: 'bday', name: 'Birthday Glow', emoji: '🎂', want: ['party', 'sweet'], pal: ['berry', 'butter', 'sky'], lvl: 20, line: 'Your day. Your cake. Your runway.' },
];
export const RULE_BANS = ['street', 'preppy', 'glam', 'cozy', 'party', 'dreamy', 'y2k', 'sweet'];

// the five chibi models. sig = the colour family of their own outfit (what shows when a slot is empty)
export const MODELS = [
  { id: 'k01', name: 'Momo', sig: 'berry', line: 'Pink twin buns, big dreams' },
  { id: 'k02', name: 'Hana', sig: 'berry', line: 'Bob cut, stripes forever' },
  { id: 'k03', name: 'Zuri', sig: 'mint', line: 'Mint hoodie, sunny sneakers' },
  { id: 'k04', name: 'Yuki', sig: 'lilac', line: 'Lilac knit, headphones on' },
  { id: 'k05', name: 'Lulu', sig: 'butter', line: 'Sundress & sunshine' },
];

// ---------------------------------------------------------------- scoring (identical for everyone)
// look = { slot: { id, cw } }
export function lookPieces(look) { return Object.values(look).filter(Boolean).map(x => ({ p: pieceById(x.id), cw: x.cw || 'orig' })).filter(x => x.p); }
export function famOf(x) { const c = colourById(x.cw); return c.fam || x.p.base; }
export function score(look, ch, prev = null) {
  const items = lookPieces(look);
  // theme fit 0..45: wanted tags worn (each piece counts up to 2), minus the banned tag
  let hits = 0, bans = 0;
  for (const x of items) { hits += x.p.tags.filter(t => ch.want.includes(t)).length; if (ch.ban && x.p.tags.includes(ch.ban)) bans++; }
  const fit = Math.max(0, Math.min(45, Math.round(hits / 8 * 45) - bans * 8));
  // colour harmony 0..35: share of pieces in the palette, a mix of 2+ palette colours, too many families clash
  const fams = items.map(famOf), inPal = fams.filter(f => ch.pal.includes(f)), distinct = new Set(fams), distinctIn = new Set(inPal);
  let harmony = 0;
  if (items.length) harmony = Math.round(24 * inPal.length / items.length) + (distinctIn.size >= 2 ? 11 : distinctIn.size === 1 ? 5 : 0) - 4 * Math.max(0, distinct.size - 3);
  harmony = Math.max(0, Math.min(35, harmony));
  // variety 0..20: slots filled (a dress fills top + skirt) + a fresh look (not a copy of your last show)
  const dress = items.some(x => x.p.dress), filled = Math.min(6, items.length + (dress ? 1 : 0));
  let fresh = 5;
  if (prev) { const same = items.filter(x => prev[x.p.slot] && prev[x.p.slot].id === x.p.id && (prev[x.p.slot].cw || 'orig') === x.cw).length; if (items.length && same / items.length > 0.5) fresh = 0; }
  const variety = Math.min(20, Math.round(filled * 2.5) + fresh);
  return { fit, harmony, variety, total: Math.min(100, fit + harmony + variety), hits, bans };
}

// the best option for one slot given the rest of the look (used by rivals, the stylist tip and the bot)
export function bestFor(slot, look, ch, avail, prev = null) {
  let best = [], bv = -1e9;
  const opts = [null];
  for (const p of PIECES) if (p.slot === slot) for (const c of COLOURS) if (avail(p, c)) opts.push({ id: p.id, cw: c.id });
  for (const o of opts) {
    const L = { ...look, [slot]: o };
    if (o && pieceById(o.id).dress) L.bottom = null;
    if (slot === 'bottom' && o && look.top && pieceById(look.top.id)?.dress) continue;
    const v = score(L, ch, prev).total;
    if (v > bv + 0.01) { bv = v; best = [o]; } else if (Math.abs(v - bv) <= 0.01) best.push(o);
  }
  return { best, v: bv };
}

// ---------------------------------------------------------------- the simulated vote (honest: labelled "simulated")
export const FANS = 100;
export function simulateVote(scores, ch, r) {
  const votes = scores.map(() => 0);
  for (let f = 0; f < FANS; f++) {
    // each simulated fan has a small personal taste (one of the theme's tags) and some randomness
    const fav = ch.want[Math.floor(r() * ch.want.length)];
    let bi = 0, bv = -1e9;
    scores.forEach((s, i) => {
      const g = (r() + r() + r() - 1.5) * 9;          // ~normal noise, σ≈5
      const v = s.sc.total + g + (s.tags.includes(fav) ? 3 : 0);
      if (v > bv) { bv = v; bi = i; }
    });
    votes[bi]++;
  }
  return votes;
}

// ---------------------------------------------------------------- stickers (album) and studio decor (meta)
export const STICKERS = [
  ...THEMES.map(t => ({ id: 'th_' + t.id, page: 0, name: t.name, emoji: t.emoji })),
  ...MODELS.map(m => ({ id: 'fr_' + m.id, page: 1, name: m.name, model: m.id })),
  { id: 'fr_k06', page: 1, name: 'Bun-Bun', emoji: '🐰' }, { id: 'fr_k07', page: 1, name: 'Mochi Cat', emoji: '🐱' },
  { id: 'st_streak3', page: 1, name: '3-day streak', emoji: '🔥' },
  ...PIECES.map(p => ({ id: 'pc_' + p.id, page: 2, name: p.name, piece: p.id })),
];
export const PAGES = ['Runway Themes', 'Glow Friends', 'Closet Icons'];

export const DECOR = [
  { id: 'h05', name: 'Cloud Rug', cost: 2, pos: [0, 0, 0.6], size: 1.5, rot: 0 },
  { id: 'h04', name: 'Bulb Vanity', cost: 3, pos: [-1.35, 0, -0.85], size: 1.05, rot: 0.35 },
  { id: 'h02', name: 'Heart Beanbag', cost: 3, pos: [1.25, 0, 0.1], size: 0.8, rot: -0.6 },
  { id: 'h06', name: 'Mushroom Lamp', cost: 3, pos: [1.6, 0, -0.95], size: 0.6, rot: -0.3 },
  { id: 'h08', name: 'Wall Shelf', cost: 4, pos: [0.35, 1.25, -1.33], size: 0.75, rot: 0, wall: true },
  { id: 'h07', name: 'Succulent', cost: 3, pos: [-0.55, 0, -1.05], size: 0.4, rot: 0 },
  { id: 'g15', name: 'Teddy', cost: 4, pos: [1.05, 0.5, 0.1], size: 0.38, rot: -0.5, on: 'h02' },
  { id: 'h12', name: 'Kitty Tower', cost: 5, pos: [-1.75, 0, 0.35], size: 1.2, rot: 0.6 },
  { id: 'g17', name: 'Big Bunny', cost: 5, pos: [-0.9, 0, 0.75], size: 0.55, rot: 0.4 },
];

// Strut Off — wardrobe, themes, venues and rivals. Every piece of the look (colour, finish, 4 accessory slots) carries
// up to two style tags; a theme wants two tags and bans one. Scoring (score()) is the same for the player and the rivals.

export const TAGS = {
  floral: ['🌸', 'Floral'], cute: ['🎀', 'Cute'], glam: ['💎', 'Glam'], royal: ['👑', 'Royal'], beach: ['🌊', 'Beach'],
  retro: ['📻', 'Retro'], cozy: ['☕', 'Cozy'], boho: ['🌾', 'Boho'], party: ['🎉', 'Party'], street: ['🛹', 'Street'],
  sporty: ['🏀', 'Sporty'], edgy: ['🖤', 'Edgy'], spooky: ['🦇', 'Spooky'], futuristic: ['🚀', 'Future'], fantasy: ['🦄', 'Fantasy'],
  western: ['🤠', 'Western'],
};

// outfit colour: absolute target hue (the model's own main hue is measured and shifted onto it), saturation and
// brightness multipliers. css = the swatch shown in the wardrobe.
export const COLOURS = [
  { id: 'sig', name: 'Signature', h: null, s: 1, b: 1, css: 'conic-gradient(#ff8fb1,#ffd36b,#7fe0c4,#8fb8ff,#c79bff,#ff8fb1)', tags: [], lvl: 1 },
  { id: 'blush', name: 'Blush', h: 0.95, s: 0.62, b: 1.18, css: '#ffb3c8', tags: ['cute', 'floral'], lvl: 1 },
  { id: 'mint', name: 'Mint', h: 0.43, s: 0.6, b: 1.15, css: '#9ff0d0', tags: ['floral', 'cozy'], lvl: 1 },
  { id: 'sky', name: 'Sky', h: 0.57, s: 0.7, b: 1.12, css: '#9fd2ff', tags: ['cozy', 'beach'], lvl: 1 },
  { id: 'sun', name: 'Sunshine', h: 0.14, s: 1.05, b: 1.15, css: '#ffe066', tags: ['beach', 'retro'], lvl: 1 },
  { id: 'hot', name: 'Hot Pink', h: 0.92, s: 1.35, b: 1.05, css: '#ff3d9a', tags: ['party', 'glam'], lvl: 2 },
  { id: 'noir', name: 'Noir', h: 0.75, s: 0.25, b: 0.34, css: '#2a2533', tags: ['edgy', 'spooky'], lvl: 3 },
  { id: 'coral', name: 'Coral', h: 0.02, s: 1.0, b: 1.12, css: '#ff8a6b', tags: ['beach', 'boho'], lvl: 4 },
  { id: 'lilac', name: 'Lilac', h: 0.76, s: 0.6, b: 1.15, css: '#c9a6ff', tags: ['fantasy', 'floral'], lvl: 5 },
  { id: 'royal', name: 'Royal Blue', h: 0.63, s: 1.25, b: 0.85, css: '#3157d6', tags: ['royal', 'sporty'], lvl: 6 },
  { id: 'sand', name: 'Desert Sand', h: 0.085, s: 0.55, b: 1.0, css: '#d9a874', tags: ['western', 'boho'], lvl: 7 },
  { id: 'violet', name: 'Violet', h: 0.8, s: 1.2, b: 0.8, css: '#8a3cf0', tags: ['glam', 'spooky'], lvl: 7 },
  { id: 'teal', name: 'Electric Teal', h: 0.5, s: 1.35, b: 0.95, css: '#13c7c0', tags: ['street', 'futuristic'], lvl: 9 },
  { id: 'ivory', name: 'Ivory', h: 0.11, s: 0.14, b: 1.4, css: '#fff4df', tags: ['royal', 'glam'], lvl: 10 },
  { id: 'lime', name: 'Lime Pop', h: 0.24, s: 1.3, b: 1.1, css: '#b8f03a', tags: ['sporty', 'futuristic'], lvl: 12 },
];

// fabric finish: rough/metal override the outfit (skin and hair untouched), glitter/neon/pearl/velvet are shader layers,
// pat = 1 polka dots, 2 stripes
export const FINISHES = [
  { id: 'matte', name: 'Cotton', rough: 0.92, metal: 0, css: 'linear-gradient(160deg,#f3e9e2,#d9c8bd)', tags: ['cozy', 'street'], lvl: 1 },
  { id: 'satin', name: 'Satin', rough: 0.3, metal: 0.05, velvet: 0.25, css: 'linear-gradient(160deg,#fff,#ffd6e6 45%,#fff 55%,#f7b8cf)', tags: ['cute', 'floral'], lvl: 1 },
  { id: 'glitter', name: 'Glitter', rough: 0.35, metal: 0.35, glitter: 1, css: 'radial-gradient(circle at 30% 30%,#fff 0 6%,transparent 7%),radial-gradient(circle at 70% 60%,#fff 0 5%,transparent 6%),linear-gradient(135deg,#ffb3e1,#c38bff)', tags: ['party', 'glam'], lvl: 2 },
  { id: 'velvet', name: 'Velvet', rough: 1, metal: 0, velvet: 1, bri: 0.85, css: 'radial-gradient(circle at 40% 30%,#c0516f,#6b1230)', tags: ['royal', 'cozy'], lvl: 3 },
  { id: 'stripes', name: 'Sport Stripes', rough: 0.7, metal: 0, pat: 2, css: 'repeating-linear-gradient(90deg,#fff 0 6px,#ff6b8b 6px 12px)', tags: ['sporty', 'street'], lvl: 4 },
  { id: 'metal', name: 'Chrome', rough: 0.22, metal: 0.85, css: 'linear-gradient(160deg,#fff,#b8c3d6 40%,#eef2f8 55%,#8a96ad)', tags: ['futuristic', 'edgy'], lvl: 5 },
  { id: 'polka', name: 'Polka Dots', rough: 0.55, metal: 0, pat: 1, css: 'radial-gradient(circle,#fff 0 3px,transparent 4px) 0 0/12px 12px,#ff7aa8', tags: ['retro', 'cute'], lvl: 6 },
  { id: 'suede', name: 'Suede', rough: 1, metal: 0, velvet: 0.5, bri: 0.92, css: 'linear-gradient(160deg,#d9a46c,#9c6a3c)', tags: ['western', 'boho'], lvl: 7 },
  { id: 'neon', name: 'Neon Glow', rough: 0.4, metal: 0.1, neon: 1, css: 'radial-gradient(circle,#fff 0 20%,#3dfcff 45%,#ff3dd5)', tags: ['party', 'futuristic'], lvl: 8 },
  { id: 'pearl', name: 'Pearl', rough: 0.22, metal: 0.25, pearl: 1, css: 'linear-gradient(135deg,#fff 10%,#ffe3f4 35%,#dff4ff 60%,#fff6dc 85%)', tags: ['beach', 'fantasy'], lvl: 10 },
];

// accessories. src: hl = a Hero Lab item (GLB or code-built, mounted by kit/heroparts), my = built here (dress.js).
// lvl = unlocked by reaching that challenge; gem = sold in the boutique instead.
export const ITEMS = [
  // head
  { id: 'crown_f', slot: 'head', name: 'Flower Crown', my: 'flowercrown', tags: ['floral', 'boho'], lvl: 1 },
  { id: 'bow', slot: 'head', name: 'Satin Bow', my: 'bow', tags: ['cute', 'retro'], lvl: 1 },
  { id: 'h02', slot: 'head', name: 'Pom Beanie', hl: 'h02', tags: ['cozy', 'cute'], lvl: 1 },
  { id: 'tiara', slot: 'head', name: 'Tiara', my: 'tiara', tags: ['royal', 'glam'], lvl: 2 },
  { id: 'sunhat', slot: 'head', name: 'Sun Hat', my: 'sunhat', tags: ['beach', 'boho'], lvl: 3 },
  { id: 'h01', slot: 'head', name: 'Street Cap', hl: 'h01', tags: ['street', 'sporty'], lvl: 4 },
  { id: 'x_party', slot: 'head', name: 'Party Cone', hl: 'x_party', tags: ['party', 'cute'], lvl: 5 },
  { id: 'x_ears', slot: 'head', name: 'Bunny Ears', hl: 'x_ears', tags: ['cute', 'fantasy'], lvl: 6 },
  { id: 'h05', slot: 'head', name: 'Ranch Hat', hl: 'h05', tags: ['western', 'boho'], lvl: 7 },
  { id: 'clip', slot: 'head', name: 'Butterfly Clip', my: 'clip', tags: ['floral', 'fantasy'], lvl: 8 },
  { id: 'h09', slot: 'head', name: 'Gamer Cans', hl: 'h09', tags: ['street', 'futuristic'], lvl: 9 },
  { id: 'x_horns', slot: 'head', name: 'Devil Horns', hl: 'x_horns', tags: ['spooky', 'edgy'], lvl: 10 },
  { id: 'x_band', slot: 'head', name: 'Sweatband', hl: 'x_band', tags: ['sporty', 'retro'], lvl: 11 },
  { id: 'x_halo', slot: 'head', name: 'Halo', hl: 'x_halo', tags: ['fantasy', 'glam'], lvl: 12 },
  { id: 'h03', slot: 'head', name: 'Royal Crown', hl: 'h03', tags: ['royal', 'glam'], gem: 120 },
  { id: 'h04', slot: 'head', name: 'Star Wizard', hl: 'h04', tags: ['fantasy', 'spooky'], gem: 150 },
  // face
  { id: 'hearts', slot: 'face', name: 'Heart Shades', my: 'hearts', tags: ['cute', 'beach'], lvl: 1 },
  { id: 'x_round', slot: 'face', name: 'Round Specs', hl: 'x_round', tags: ['retro', 'cozy'], lvl: 1 },
  { id: 'f01', slot: 'face', name: 'Slick Shades', hl: 'f01', tags: ['street', 'edgy'], lvl: 4 },
  { id: 'x_masq', slot: 'face', name: 'Masquerade', hl: 'x_masq', tags: ['glam', 'spooky'], lvl: 6 },
  { id: 'x_visor', slot: 'face', name: 'Neon Visor', hl: 'x_visor', tags: ['futuristic', 'party'], lvl: 8 },
  { id: 'x_goggles', slot: 'face', name: 'Brass Goggles', hl: 'x_goggles', tags: ['retro', 'fantasy'], lvl: 13 },
  { id: 'x_stache', slot: 'face', name: 'Big Stache', hl: 'x_stache', tags: ['western', 'retro'], lvl: 15 },
  { id: 'f04', slot: 'face', name: 'Carnival Mask', hl: 'f04', tags: ['party', 'glam'], gem: 90 },
  // back
  { id: 'wings_b', slot: 'back', name: 'Butterfly Wings', my: 'bwings', tags: ['floral', 'fantasy'], lvl: 2 },
  { id: 'x_cape', slot: 'back', name: 'Velvet Cape', hl: 'x_cape', tags: ['royal', 'fantasy'], lvl: 5 },
  { id: 'b04', slot: 'back', name: 'Explorer Pack', hl: 'b04', tags: ['sporty', 'boho'], lvl: 7 },
  { id: 'b02', slot: 'back', name: 'Seraph Wings', hl: 'b02', tags: ['glam', 'fantasy'], lvl: 9 },
  { id: 'b03', slot: 'back', name: 'Night Wings', hl: 'b03', tags: ['spooky', 'edgy'], lvl: 11 },
  { id: 'x_jet', slot: 'back', name: 'Jetpack', hl: 'x_jet', tags: ['futuristic', 'sporty'], lvl: 14 },
  // hands
  { id: 'bag', slot: 'hand', name: 'Quilted Bag', my: 'bag', tags: ['glam', 'retro'], lvl: 1 },
  { id: 'flower', slot: 'hand', name: 'Sunflower', my: 'sunflower', tags: ['floral', 'beach'], lvl: 1 },
  { id: 'perfume', slot: 'hand', name: 'Perfume', my: 'perfume', tags: ['glam', 'party'], lvl: 3 },
  { id: 'parasol', slot: 'hand', name: 'Parasol', my: 'parasol', tags: ['beach', 'retro'], lvl: 4 },
  { id: 'x_ball', slot: 'hand', name: 'Hoop Ball', hl: 'x_ball', tags: ['sporty', 'street'], lvl: 5 },
  { id: 'fan', slot: 'hand', name: 'Silk Fan', my: 'fan', tags: ['royal', 'retro'], lvl: 6 },
  { id: 'w05', slot: 'hand', name: 'Axe Guitar', hl: 'w05', tags: ['edgy', 'party'], lvl: 8 },
  { id: 'w07', slot: 'hand', name: 'Old Lantern', hl: 'w07', tags: ['cozy', 'spooky'], lvl: 10 },
  { id: 'x_board', slot: 'hand', name: 'Skateboard', hl: 'x_board', tags: ['street', 'sporty'], lvl: 12 },
  { id: 'x_staff', slot: 'hand', name: 'Crystal Staff', hl: 'x_staff', tags: ['fantasy', 'royal'], gem: 110 },
];
export const SLOTS = [
  { key: 'colour', icon: '🎨', name: 'Colour' }, { key: 'finish', icon: '✨', name: 'Fabric' },
  { key: 'head', icon: '👑', name: 'Head' }, { key: 'face', icon: '🕶️', name: 'Face' },
  { key: 'back', icon: '🪽', name: 'Back' }, { key: 'hand', icon: '👜', name: 'Hand' },
];
export const ACC = ['head', 'face', 'back', 'hand'];
export const itemById = id => ITEMS.find(i => i.id === id);
export const colourById = id => COLOURS.find(c => c.id === id);
export const finishById = id => FINISHES.find(f => f.id === id);

// themes debut in this order (lvl = first challenge it can appear in); pose = the clip the model ends the walk with
export const THEMES = [
  { id: 'garden', name: 'Garden Party', emoji: '🌷', want: ['floral', 'cute'], ban: 'edgy', lvl: 1, line: 'Petals, pastels and a picnic blanket.' },
  { id: 'beach', name: 'Beach Bash', emoji: '🏖️', want: ['beach', 'cute'], ban: 'spooky', lvl: 2, line: 'Sun, sand and a very cool drink.' },
  { id: 'cafe', name: 'Cozy Café', emoji: '☕', want: ['cozy', 'retro'], ban: 'party', lvl: 3, line: 'Rainy day, warm latte, vinyl on.' },
  { id: 'tea', name: 'Royal Tea', emoji: '🫖', want: ['royal', 'glam'], ban: 'sporty', lvl: 4, line: 'Pinkies up, darling.' },
  { id: 'street', name: 'Street Style', emoji: '🛹', want: ['street', 'sporty'], ban: 'royal', lvl: 5, line: 'The sidewalk is your runway.' },
  { id: 'pop', name: 'Pop Party', emoji: '🎈', want: ['party', 'cute'], ban: 'cozy', lvl: 6, line: 'Confetti in your hair by 9 pm.' },
  { id: 'fairy', name: 'Fairy Tale', emoji: '🧚', want: ['fantasy', 'floral'], ban: 'street', lvl: 7, line: 'Once upon a runway…' },
  { id: 'west', name: 'Wild West', emoji: '🤠', want: ['western', 'boho'], ban: 'futuristic', lvl: 8, line: 'Boots on, the rodeo starts at noon.' },
  { id: 'rock', name: 'Rock Star', emoji: '🎸', want: ['edgy', 'party'], ban: 'cute', lvl: 9, line: 'Loud outfit. Louder encore.' },
  { id: 'neon', name: 'Neon Night', emoji: '🌃', want: ['futuristic', 'party'], ban: 'cozy', lvl: 10, line: 'Glow brighter than the club lights.' },
  { id: 'spooky', name: 'Spooky Soirée', emoji: '🦇', want: ['spooky', 'glam'], ban: 'beach', lvl: 11, line: 'Elegantly eerie. Fangs optional.' },
  { id: 'boho', name: 'Boho Festival', emoji: '🌻', want: ['boho', 'floral'], ban: 'edgy', lvl: 12, line: 'Three days, one field, zero worries.' },
  { id: 'diner', name: 'Retro Diner', emoji: '🍒', want: ['retro', 'cute'], ban: 'fantasy', lvl: 13, line: 'Milkshakes, jukebox, roller skates.' },
  { id: 'space', name: 'Space Couture', emoji: '🚀', want: ['futuristic', 'glam'], ban: 'western', lvl: 14, line: 'Haute couture, zero gravity.' },
  { id: 'sport', name: 'Sports Day', emoji: '🏅', want: ['sporty', 'cute'], ban: 'spooky', lvl: 15, line: 'Win the race, win the look.' },
  { id: 'gala', name: 'Midnight Gala', emoji: '🥂', want: ['glam', 'royal'], ban: 'street', lvl: 16, line: 'Black tie, gold everything.' },
];
export const RULES = [   // extra twist from challenge 6: a slot that must be filled
  { slot: 'head', text: 'Must wear: headwear' }, { slot: 'hand', text: 'Must carry: something in hand' },
  { slot: 'back', text: 'Must wear: wings, cape or pack' }, { slot: 'face', text: 'Must wear: eyewear or mask' },
];

// five venues, 8 challenges each, then they cycle
export const VENUES = [
  { id: 'rooftop', name: 'Rose Rooftop', sky: ['#ffb38f', '#ff9cbc', '#b98cff'], run: '#fff4f7', edge: '#ff4f97', floor: '#e79ab4', wall: '#ffc2d6', cone: '#fff0dc', seat: '#f7a6c2', plants: true },
  { id: 'neon', name: 'Neon Lounge', sky: ['#3b1d78', '#8a2fb8', '#ff5fb0'], run: '#efe2ff', edge: '#3dfcff', floor: '#5b3a91', wall: '#6a3fb0', cone: '#ff9cf0', seat: '#7d55c2', lasers: true },
  { id: 'pier', name: 'Seaside Pier', sky: ['#7fd3ff', '#b6ecff', '#fff0cf'], run: '#ffffff', edge: '#13b5c4', floor: '#8fd3cf', wall: '#a6e3ec', cone: '#fffbe6', seat: '#7cc9d8', plants: true },
  { id: 'palace', name: 'Palace Hall', sky: ['#ffd99a', '#ffbf7a', '#e88f8f'], run: '#fff6e8', edge: '#e0a83a', floor: '#c98f6a', wall: '#f0cfa8', cone: '#fff2cc', seat: '#c46a7a', chandeliers: true, carpet: '#c8324f' },
  { id: 'snow', name: 'Snow Lodge', sky: ['#a9cbff', '#cdbdff', '#f6f0ff'], run: '#ffffff', edge: '#6a9cff', floor: '#b9c9ee', wall: '#cfdcff', cone: '#f2f6ff', seat: '#93a9e0', snow: true },
];

// rivals (Hero Lab fashion characters) and the judges
export const RIVALS = [
  { id: 'p02', name: 'Seoa Star' }, { id: 'p07', name: 'Bijou' }, { id: 'p10', name: 'Velvet Noir' },
  { id: 'p04', name: 'Riot Roxy' }, { id: 'p01', name: 'Jaylen Drip' }, { id: 'p12', name: 'Tex Rhinestone' },
];
export const JUDGES = [{ id: 'p05', name: 'Granny Gloss' }, { id: 'p08', name: 'Mr Mustard' }];
export const MODEL_DEFAULT = { id: 'p15', name: 'Rouge' };
export const LOCAL_CHARS = ['p15', 'p02', 'p07', 'p10', 'p04', 'p01', 'p12', 'p05', 'p08'];

export const RANKS = [[0, 'Newcomer'], [6, 'Rising Star'], [18, 'Trendsetter'], [36, 'It Girl'], [60, 'Runway Pro'], [90, 'Style Icon'], [130, 'Living Legend']];
export const rankOf = stars => RANKS.filter(r => stars >= r[0]).pop()[1];

// ------------------------------------------------------------------ scoring (same for everyone)
// outfit = { colour, finish, head, face, back, hand } (ids or null); sigTags = the tags the model's own colour reads as
export function pieces(o, sigTags = []) {
  const out = [];
  const c = colourById(o.colour); if (c) out.push({ slot: 'colour', id: c.id, name: c.name, tags: c.id === 'sig' ? sigTags : c.tags });
  const f = finishById(o.finish); if (f) out.push({ slot: 'finish', id: f.id, name: f.name, tags: f.tags });
  for (const s of ACC) { const it = itemById(o[s]); if (it) out.push({ slot: s, id: it.id, name: it.name, tags: it.tags }); }
  return out;
}
export function score(o, ch, sigTags = []) {
  const P = pieces(o, sigTags), lines = [];
  let pts = 0;
  for (const p of P) {
    const hit = p.tags.filter(t => ch.want.includes(t)).length, bad = p.tags.includes(ch.ban);
    const v = (hit === 2 ? 22 : hit ? 12 : 0) - (bad ? 14 : 0);
    pts += v; lines.push({ ...p, hit, bad, v });
  }
  const acc = ACC.filter(s => o[s]).length;
  const full = acc * 3; pts += full;
  // a look where colour and fabric both match the brief reads as "head to toe"
  const harmony = lines.filter(l => (l.slot === 'colour' || l.slot === 'finish') && l.hit > 0).length === 2 ? 6 : 0; pts += harmony;
  const missing = ch.rule && !o[ch.rule.slot] ? 20 : 0; pts -= missing;
  return { pts: Math.max(0, Math.round(pts)), lines, full, harmony, missing };
}
// the best possible piece for each part of the look, from what's available
export function bestFor(slot, ch, avail, sigTags = []) {
  const list = slot === 'colour' ? COLOURS : slot === 'finish' ? FINISHES : ITEMS.filter(i => i.slot === slot);
  let best = [], bv = -1e9;
  for (const x of list) {
    if (!avail(x)) continue;
    const tags = x.id === 'sig' ? sigTags : x.tags, hit = tags.filter(t => ch.want.includes(t)).length, bad = tags.includes(ch.ban);
    const v = (hit === 2 ? 22 : hit ? 12 : 0) - (bad ? 14 : 0);
    if (v > bv) { bv = v; best = [x]; } else if (v === bv) best.push(x);
  }
  return { best, v: bv };
}

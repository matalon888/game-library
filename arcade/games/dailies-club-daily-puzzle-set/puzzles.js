// Dailies Club puzzles: one set per calendar day, the same for everyone, seeded by the date.
//   Vibe Check  — 16 words, find the 4 hidden groups of 4 (original groups, tiered butter → strawberry)
//   Decode      — an emoji rebus (🧈 + 🪰 = BUTTERFLY) or a scrambled club word, spelled with letter bubbles
//   Mini Grid   — a tiny logic grid: who has which boba / pet / snack, from 3–6 clues (exactly one solution)
// Week rhythm: Monday is gentle, Saturday is the flagged Hard day (still short), Sunday is chill.

// ---------------------------------------------------------------- dates
export const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const fromNum = n => new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100, 12);
export const addDays = (n, k) => { const d = fromNum(n); d.setDate(d.getDate() + k); return dayNum(d); };
const EPOCH = Date.UTC(2026, 0, 1);
export const setNo = n => { const d = fromNum(n); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5) + 1; };
export const weekday = n => fromNum(n).getDay();            // 0 Sun … 6 Sat
export const isHard = n => weekday(n) === 6;
export const isGentle = n => weekday(n) === 1;

// ---------------------------------------------------------------- seeded random
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = hash(seed) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, r) => a[Math.floor(r() * a.length)];

// ---------------------------------------------------------------- Vibe Check groups (all original)
// tier 1 butter (straight category) · 2 mint (a bit of thought) · 3 sky (fill-in-the-blank) · 4 strawberry (wordplay)
const G = (t, name, words) => ({ t, name, words: words.split(' ') });
export const GROUPS = [
  G(1, 'Boba shop menu', 'TAPIOCA PUDDING JELLY FOAM TARO LYCHEE'),
  G(1, 'Skincare steps', 'CLEANSER TONER SERUM SPF MASK MIST'),
  G(1, 'Pastel paint names', 'LILAC MINT PEACH BUTTER BLUSH SKY'),
  G(1, 'Sleepover must-haves', 'PILLOW BLANKET SNACKS PAJAMAS MOVIE FACEMASK'),
  G(1, 'Baby animals', 'KITTEN PUPPY BUNNY DUCKLING FAWN PIGLET'),
  G(1, 'Stationery haul', 'STICKERS NOTEBOOK ERASER MARKER WASHI PLANNER'),
  G(1, 'Bakery case', 'MOCHI MACARON CREPE DONUT CUPCAKE TART'),
  G(1, 'Hair accessories', 'CLIP SCRUNCHIE HEADBAND BARRETTE TIARA BOW'),
  G(1, 'Weather report', 'SUNNY RAINY CLOUDY WINDY STORMY FOGGY'),
  G(1, 'Fruit bowl', 'MANGO CHERRY LEMON KIWI PLUM GRAPE'),
  G(1, 'Music genres', 'POP INDIE JAZZ FOLK DISCO PUNK'),
  G(1, 'Star signs', 'ARIES LEO VIRGO LIBRA GEMINI PISCES'),
  G(1, 'Planets', 'MARS VENUS SATURN JUPITER MERCURY NEPTUNE'),
  G(1, 'Café drinks', 'LATTE MOCHA CHAI MATCHA CORTADO FRAPPE'),
  G(1, 'Gemstones', 'OPAL PEARL RUBY JADE AMBER TOPAZ'),
  G(1, 'Flowers', 'TULIP DAISY PEONY LILY ROSE IRIS'),
  G(1, 'Instruments', 'UKULELE PIANO DRUMS VIOLIN FLUTE HARP'),
  G(1, 'Shoes', 'SNEAKERS BOOTS LOAFERS CLOGS SANDALS HEELS'),
  G(1, 'Sushi bar', 'NIGIRI MAKI WASABI NORI TEMPURA EDAMAME'),
  G(1, 'Pasta shapes', 'PENNE ORZO FUSILLI RIGATONI SHELLS RAVIOLI'),
  G(1, 'Ocean friends', 'OTTER WHALE SEAL DOLPHIN TURTLE OCTOPUS'),
  G(1, 'Breakfast', 'WAFFLES PANCAKES CEREAL TOAST BAGEL OMELET'),
  G(2, 'Things that glow', 'FIREFLY NEON MOON CANDLE LANTERN EMBER'),
  G(2, 'Nail salon', 'POLISH FILE BUFFER CUTICLE ACRYLIC GEL'),
  G(2, 'Braid styles', 'FRENCH DUTCH FISHTAIL BOX CROWN ROPE'),
  G(2, 'Things with shells', 'SNAIL TACO EGG PEANUT CRAB OYSTER'),
  G(2, 'Things with wings', 'ANGEL FAIRY PLANE DRAGON BAT PEGASUS'),
  G(2, 'Slang for "amazing"', 'FIRE ICONIC ELITE GOATED BUSSIN UNREAL'),
  G(2, 'Things with tails', 'COMET KITE PONY MERMAID MOUSE TADPOLE'),
  G(2, 'Room decor', 'MIRROR RUG POSTER PLANT BEANBAG LAMP'),
  G(2, '___core aesthetics', 'COTTAGE FAIRY GOBLIN BALLET GRANDMA MERMAID'),
  G(2, 'Things that pop', 'BALLOON BUBBLE CORK QUESTION KERNEL TOASTER'),
  G(2, 'In a pencil case', 'RULER PENCIL SHARPENER GLUESTICK COMPASS PEN'),
  G(2, 'Things you can braid', 'HAIR BREAD ROPE BRACELET RIBBON YARN'),
  G(2, 'Things with keys', 'PIANO KEYBOARD MAP DIARY LOCKER LAPTOP'),
  G(2, 'Picnic basket', 'GRAPES SANDWICH BLANKET THERMOS NAPKIN BERRIES'),
  G(2, 'Things that are pink', 'FLAMINGO BUBBLEGUM SHRIMP BLOSSOM PIGLET CANDYFLOSS'),
  G(2, 'Things with stripes', 'ZEBRA TIGER CANDYCANE BEE BARCODE SCARF'),
  G(2, 'Things that sparkle', 'GLITTER SEQUIN DIAMOND TINSEL FROST SPARKLER'),
  G(2, 'Cozy fabrics', 'FLEECE VELVET CASHMERE FLANNEL SHERPA CORDUROY'),
  G(3, '___ girl (summer edition)', 'CLEAN VANILLA TOMATO COCONUT THAT SOFT'),
  G(3, 'Main ___', 'CHARACTER COURSE STREET EVENT STAGE QUEST'),
  G(3, '___cake', 'CUP PAN CHEESE SPONGE SHORT CRAB'),
  G(3, 'Sun___', 'FLOWER SET GLASSES SHINE BURN DAY'),
  G(3, '___ board', 'VISION MOOD SKATE SNOW SURF CHEESE'),
  G(3, 'Star___', 'FISH DUST LIGHT FRUIT STRUCK GAZER'),
  G(3, '___ party', 'SLUMBER TEA PIZZA DANCE POOL BLOCK'),
  G(3, '___ break', 'SPRING HEART COFFEE LUCKY JAIL WIND'),
  G(3, 'Moon___', 'LIGHT WALK STONE BEAM CAKE SHINE'),
  G(3, '___ ball', 'SNOW DISCO BEACH GUM PUFF EYE'),
  G(3, 'Lip ___', 'GLOSS BALM STICK LINER SYNC OIL'),
  G(3, 'Add -ie for a club word', 'BEST SELF ROOM FOOD SWEET GOOD'),
  G(3, 'Bubble ___', 'TEA BATH GUM WRAP WAND MACHINE'),
  G(3, '___ fly', 'BUTTER DRAGON FIRE BUTTER MAY HOUSE'),
  G(3, 'Glow ___', 'UP STICK WORM STONE RING'),
  G(3, 'Cloud ___', 'NINE BURST STORAGE COVER BREAD'),
  G(4, 'Hidden animals', 'SCATTER PIGMENT COWARD HENNA BATON CRATE'),
  G(4, 'Add S for slang', 'LAY TAN PILL HOOK HIP'),
  G(4, 'Sound like letters', 'BEE SEA TEA EYE PEA JAY'),
  G(4, 'Palindromes', 'LEVEL KAYAK RADAR CIVIC NOON STATS'),
  G(4, 'Another word backwards', 'STRESSED DRAWER STAR LIVE SNAP KEEP'),
  G(4, 'Hidden body parts', 'CHINA ARMY KNEEL LEGEND SHINDIG THUMBTACK'),
  G(4, 'Hidden numbers', 'OFTEN WEIGHT CANINE TONE FREIGHT LONESOME'),
  G(4, 'Hidden colours', 'SHREDDING GOLDEN GREYHOUND TANGO BLUEBELL'),
  G(4, 'Rhymes with "slay"', 'SLEIGH WEIGH BALLET BOUQUET PARFAIT CAFE'),
  G(4, 'Hidden drinks', 'TEASE COLANDER POPSICLE SODALITE STEALTH'),
];
GROUPS.forEach(g => { g.words = [...new Set(g.words)]; });

// groups that would blur into each other on the same day
const CLASH = [['Palindromes', 'Another word backwards'], ['Braid styles', 'Things you can braid'], ['Things that glow', 'Glow ___'],
  ['Bubble ___', 'Things that pop'], ['Sun___', 'Moon___'], ['Star___', 'Moon___'], ['Things with wings', '___ fly'],
  ['Hidden animals', 'Baby animals'], ['Hidden drinks', 'Café drinks'], ['Hidden colours', 'Pastel paint names'],
  ['Things that are pink', 'Pastel paint names'], ['Bakery case', '___cake'], ['Sleepover must-haves', '___ party']];
const TIER = { 1: 'butter', 2: 'mint', 3: 'sky', 4: 'berry' };
export function vibeFor(n) {
  const r = rng('vibe' + n), hard = isHard(n), gentle = isGentle(n);
  const tiers = hard ? [2, 3, 4, 4] : gentle ? [1, 1, 2, 3] : [1, 2, 3, 4];
  const no = setNo(n);
  for (let attempt = 0; attempt < 60; attempt++) {
    const chosen = [];
    for (let i = 0; i < 4; i++) {
      const pool = GROUPS.filter(g => g.t === tiers[i] && !chosen.includes(g));
      // walk each tier in a fixed shuffled order so a group comes back only after the whole tier has been used
      const order = shuffle(pool, rng('tier' + tiers[i] + 'x' + i));
      chosen.push(attempt === 0 ? order[(no + i * 7) % order.length] : pick(pool, r));
    }
    const names = chosen.map(g => g.name);
    if (CLASH.some(([a, b]) => names.includes(a) && names.includes(b))) continue;
    const groups = []; let ok = true;
    for (const g of chosen) {
      const others = new Set(chosen.filter(o => o !== g).flatMap(o => o.words));
      const cand = shuffle(g.words.filter(w => !others.has(w)), r);
      if (cand.length < 4) { ok = false; break; }
      groups.push({ name: g.name, words: cand.slice(0, 4), tier: g.t });
    }
    if (!ok) continue;
    // colours by difficulty order (two tier-4 groups on Hard day: sky gets the easier one)
    const col = hard ? ['mint', 'sky', 'lilac', 'berry'] : gentle ? ['butter', 'mint', 'sky', 'lilac'] : ['butter', 'mint', 'sky', 'berry'];
    groups.forEach((g, i) => g.color = col[i]);
    const tiles = shuffle(groups.flatMap((g, gi) => g.words.map(w => ({ w, g: gi }))), r);
    return { groups, tiles, mistakes: 4 };
  }
  throw new Error('no vibe set');
}

// ---------------------------------------------------------------- Decode: emoji rebus + club word scramble
const RB = (a, e, h) => ({ a, e, h });
export const REBUS = [
  RB('RAINBOW', ['🌧️', '🎀'], 'After the storm'), RB('BUTTERFLY', ['🧈', '🪰'], 'Garden glow-up'),
  RB('STARFISH', ['⭐', '🐟'], 'Beach friend'), RB('SUNFLOWER', ['☀️', '🌸'], 'Tall and yellow'),
  RB('PANCAKE', ['🍳', '🎂'], 'Breakfast stack'), RB('HOTDOG', ['🔥', '🐶'], 'Picnic snack'),
  RB('BOOKWORM', ['📖', '🪱'], 'Loves reading'), RB('EARRING', ['👂', '💍'], 'Accessory'),
  RB('HANDBAG', ['✋', '👜'], 'Carry it'), RB('TOOTHBRUSH', ['🦷', '🖌️'], 'Night routine'),
  RB('CATWALK', ['🐱', '🚶‍♀️'], 'Runway'), RB('POPCORN', ['💥', '🌽'], 'Movie night'),
  RB('SUNGLASSES', ['☀️', '👓'], 'Summer look'), RB('RAINCOAT', ['🌧️', '🧥'], 'Stay dry'),
  RB('PINEAPPLE', ['🌲', '🍎'], 'Tropical fruit'), RB('WATERMELON', ['💧', '🍈'], 'Summer fruit'),
  RB('GOLDFISH', ['🥇', '🐟'], 'Tiny pet'), RB('HORSESHOE', ['🐴', '👞'], 'Lucky charm'),
  RB('MAILBOX', ['📧', '📦'], 'Letters go here'), RB('LADYBUG', ['👩', '🐛'], 'Spotty friend'),
  RB('DRAGONFLY', ['🐉', '🪰'], 'Pond flyer'), RB('SEAHORSE', ['🌊', '🐴'], 'Ocean friend'),
  RB('CARPET', ['🚗', '🐶'], 'On the floor'), RB('BRAINSTORM', ['🧠', '⛈️'], 'Big ideas'),
  RB('TEACUP', ['🍵', '🏆'], 'Sip from it'), RB('SNOWMAN', ['❄️', '👨'], 'Winter friend'),
  RB('MOONWALK', ['🌙', '🚶'], 'Dance move'), RB('FIREFLY', ['🔥', '🪰'], 'Summer night'),
  RB('HONEYMOON', ['🍯', '🌙'], 'After the wedding'), RB('BOWTIE', ['🎀', '👔'], 'Fancy neck'),
  RB('POPSTAR', ['💥', '⭐'], 'On the stage'), RB('FOOTPRINT', ['🦶', '🖨️'], 'In the sand'),
  RB('CHEESECAKE', ['🧀', '🎂'], 'Dessert'), RB('SNOWBALL', ['❄️', '⚽'], 'Winter throw'),
  RB('SUNRISE', ['☀️', '⬆️'], 'Early morning'), RB('PIGGYBANK', ['🐷', '🏦'], 'Saving up'),
  RB('HEARTBEAT', ['💗', '🥁'], 'Ba-dum'), RB('MILKSHAKE', ['🥛', '🤝'], 'Diner drink'),
  RB('STARLIGHT', ['⭐', '💡'], 'Night sky'), RB('ROSEWATER', ['🌹', '💧'], 'Skincare mist'),
  RB('CORNDOG', ['🌽', '🐶'], 'Fair snack'), RB('FISHBOWL', ['🐟', '🥣'], 'Pet home'),
  RB('KEYHOLE', ['🔑', '🕳️'], 'Peek through'), RB('HOMEWORK', ['🏠', '💼'], 'After school'),
  RB('SANDCASTLE', ['🏖️', '🏰'], 'Beach build'), RB('CUPBOARD', ['🏆', '🏄'], 'Kitchen storage'),
  RB('BEDBUG', ['🛏️', '🐛'], 'Sleep tight'), RB('JELLYFISH', ['🍮', '🐟'], 'Wobbly swimmer'),
];
export const SCRAMBLE = [
  RB('BESTIE', ['👯'], 'Your ride-or-die'), RB('VIBES', ['✨'], 'The energy'), RB('ICONIC', ['🌟'], 'Legendary'),
  RB('AESTHETIC', ['🎀'], 'The whole look'), RB('SELFIE', ['🤳'], 'Snap yourself'), RB('KAWAII', ['🌸'], 'Too cute'),
  RB('MATCHA', ['🍵'], 'Green drink'), RB('MOCHI', ['🍡'], 'Squishy sweet'), RB('PLUSHIE', ['🧸'], 'Soft toy'),
  RB('SPARKLE', ['✨'], 'Shine bright'), RB('SCRUNCHIE', ['🎀'], 'Hair thing'), RB('SKINCARE', ['🧴'], 'Glow routine'),
  RB('PLAYLIST', ['🎧'], 'Songs on repeat'), RB('SLEEPOVER', ['🌙'], 'Pajama night'), RB('GLITTER', ['💫'], 'Sparkly dust'),
  RB('JOURNAL', ['📓'], 'Dear diary'), RB('UNICORN', ['🦄'], 'Magical horse'), RB('CROCHET', ['🧶'], 'Hook and yarn'),
  RB('MOODBOARD', ['📌'], 'Pin the vibe'), RB('PICNIC', ['🧺'], 'Lunch on a blanket'), RB('CAMPFIRE', ['🔥'], 'Marshmallow time'),
  RB('LIPGLOSS', ['💄'], 'Shiny lips'), RB('HEADBAND', ['👑'], 'Hair accessory'), RB('BLOSSOM', ['🌸'], 'Spring bloom'),
  RB('CUPCAKE', ['🧁'], 'Tiny cake'), RB('STICKER', ['💟'], 'Peel and stick'), RB('DAYDREAM', ['☁️'], 'Head in the clouds'),
  RB('PAJAMAS', ['🛌'], 'Comfy fit'), RB('SUNSET', ['🌇'], 'Golden hour'), RB('BUBBLES', ['🫧'], 'Pop pop pop'),
];
const VOWELS = 'AEIOU', DECOY = 'AEIOUSTRLNMPBCDGHKY';
export function decodeFor(n) {
  const r = rng('decode' + n), no = setNo(n), rebus = no % 3 !== 0 || isHard(n);   // 2 of 3 days are rebus days
  const bank = rebus ? REBUS : SCRAMBLE;
  const order = shuffle(bank, rng(rebus ? 'rbank' : 'sbank'));
  const it = order[(no * 7) % order.length];
  const letters = [...it.a];
  if (rebus) {               // rebus: the answer's letters plus a few decoys
    const extra = isHard(n) ? 4 : isGentle(n) ? 1 : 3;
    for (let i = 0; i < extra; i++) letters.push(i % 2 ? pick(VOWELS, r) : pick(DECOY, r));
  }
  let bankL = shuffle(letters, r);
  if (!rebus) for (let k = 0; k < 8 && bankL.join('') === it.a; k++) bankL = shuffle(letters, r);
  return { kind: rebus ? 'rebus' : 'scramble', answer: it.a, emoji: it.e, hint: it.h, bank: bankL, hearts: 3 };
}

// ---------------------------------------------------------------- Mini Grid: club logic grid
export const FRIENDS = [
  { id: 'k01', name: 'Momo' }, { id: 'k02', name: 'Bea' }, { id: 'k03', name: 'Zuri' }, { id: 'k04', name: 'Kiki' }, { id: 'k05', name: 'Sunny' },
];
export const CATS = [
  { key: 'pet', title: 'pet', verb: 'has the', items: [{ id: 'p01', name: 'kitten' }, { id: 'p02', name: 'puppy' }, { id: 'p03', name: 'hamster' }, { id: 'p04', name: 'bunny' }, { id: 'p05', name: 'axolotl' }, { id: 'p06', name: 'corgi' }] },
  { key: 'snack', title: 'snack', verb: 'brought the', items: [{ id: 't02', name: 'mochi' }, { id: 't05', name: 'donut' }, { id: 't08', name: 'soft serve' }, { id: 'g09', name: 'cupcake' }, { id: 'g08', name: 'macaron' }, { id: 't07', name: 'peach' }] },
  { key: 'acc', title: 'accessory', verb: 'wears the', items: [{ id: 'w07', name: 'cat-ear headphones' }, { id: 'w09', name: 'heart shades' }, { id: 'w05', name: 'heart bag' }, { id: 'b01', name: 'satin bow' }, { id: 'w04', name: 'platform boots' }] },
  { key: 'plush', title: 'plush', verb: 'won the', items: [{ id: 'g15', name: 'bear' }, { id: 'g14', name: 'bunny charm' }, { id: 'g16', name: 'cat loaf' }, { id: 'g13', name: 'pom-pom' }, { id: 'c03', name: 'frog bun' }] },
];
function perms(n) { const out = []; const rec = (a, rest) => { if (!rest.length) return out.push(a); rest.forEach((x, i) => rec([...a, x], rest.filter((_, j) => j !== i))); }; rec([], [...Array(n).keys()]); return out; }
// a clue is a test on a candidate solution {A:[item per person], B:[...]}
function clueTest(c, s) {
  const has = (cat, p, i) => s[cat][p] === i;
  switch (c.t) {
    case 'is': return has(c.cat, c.p, c.i);
    case 'not': return !has(c.cat, c.p, c.i);
    case 'link': { const p = s[c.cat].indexOf(c.i); return p >= 0 && s[c.cat2][p] === c.i2; }
    case 'unlink': { const p = s[c.cat].indexOf(c.i); return p < 0 || s[c.cat2][p] !== c.i2; }
    case 'neither': return !has(c.cat, c.p, c.i) && !has(c.cat, c.p, c.i2);
    case 'either': return has(c.cat, c.p, c.i) || has(c.cat, c.p, c.i2);
  }
}
export function gridFor(n) {
  const r = rng('grid' + n), hard = isHard(n), N = hard || weekday(n) === 4 || weekday(n) === 5 ? 4 : 3;
  const people = shuffle(FRIENDS, r).slice(0, N);
  const [ca, cb] = shuffle(CATS, r).slice(0, 2);
  const A = shuffle(ca.items, r).slice(0, N), B = shuffle(cb.items, r).slice(0, N);
  const P = perms(N), all = [];
  for (const a of P) for (const b of P) all.push({ A: a, B: b });
  const sol = all[Math.floor(r() * all.length)];
  // candidate clues true for the solution (no direct 'is' on gentle days beyond one; Hard day avoids 'is')
  const cands = [];
  for (let p = 0; p < N; p++) for (let i = 0; i < N; i++) for (const cat of ['A', 'B']) {
    cands.push({ t: sol[cat][p] === i ? 'is' : 'not', cat, p, i });
    for (let i2 = i + 1; i2 < N; i2++) { const c = { t: 'neither', cat, p, i, i2 }; if (clueTest(c, sol)) cands.push(c); const e = { t: 'either', cat, p, i, i2 }; if (clueTest(e, sol)) cands.push(e); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const c = { t: 'link', cat: 'A', i, cat2: 'B', i2: j };
    cands.push(clueTest(c, sol) ? c : { t: 'unlink', cat: 'A', i, cat2: 'B', i2: j });
  }
  const weight = c => ({ is: hard ? 0.15 : 0.6, not: 1, link: 1.3, unlink: 1.1, neither: 1.2, either: 1.1 })[c.t];
  let best = null;
  for (let tries = 0; tries < 40 && !best; tries++) {
    const pool = shuffle(cands, r).sort((x, y) => weight(y) * r() - weight(x) * r());
    let left = all, clues = [], isN = 0;
    for (const c of pool) {
      if (c.t === 'is' && isN >= (hard ? 0 : 1)) continue;
      const nl = left.filter(s => clueTest(c, s));
      if (nl.length === left.length) continue;
      clues.push(c); left = nl; if (c.t === 'is') isN++;
      if (left.length === 1) break;
    }
    if (left.length !== 1) continue;
    // drop clues that aren't needed (keeps it short and tidy)
    for (let k = clues.length - 1; k >= 0; k--) {
      const rest = clues.filter((_, j) => j !== k);
      if (all.filter(s => rest.every(c => clueTest(c, s))).length === 1) clues = rest;
    }
    if (clues.length <= (N === 3 ? 5 : 7)) best = clues;
  }
  if (!best) throw new Error('no grid');
  return { N, people, cats: [ca, cb], items: [A, B], sol, clues: shuffle(best, r), hearts: 3 };
}

// ---------------------------------------------------------------- the set
export function setFor(n) { return { n, no: setNo(n), hard: isHard(n), gentle: isGentle(n), v: vibeFor(n), d: decodeFor(n), g: gridFor(n) }; }
export const TIERNAME = TIER;

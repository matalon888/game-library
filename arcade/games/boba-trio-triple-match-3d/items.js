// The goodies. Every id is a kawaii AI 3D prop from assets/kawaii/web (copied into ./assets/<id>.glb + ./assets/thumbs/<id>.webp).
// Add a piece: copy the .glb + thumb into ./assets and add it to a page below. `s` = optional size tweak (1 = default).
export const PAGES = [
  { key: 'boba', name: 'Boba Bar', icon: 't01', items: [
    { id: 't01', name: 'Boba tea' }, { id: 't02', name: 'Mochi' }, { id: 't05', name: 'Donut' }, { id: 't08', name: 'Soft serve' },
    { id: 't09', name: 'Heart lollipop', s: 0.95 }, { id: 'g08', name: 'Macaron' }, { id: 'g09', name: 'Cupcake' }, { id: 'f02', name: 'Bao bun' },
    { id: 'f01', name: 'Dumpling' } ] },
  { key: 'fruit', name: 'Fruit Garden', icon: 't03', items: [
    { id: 't03', name: 'Strawberry' }, { id: 't06', name: 'Cherries' }, { id: 't07', name: 'Peach' }, { id: 'f05', name: 'Onigiri' },
    { id: 'f04', name: 'Nigiri' }, { id: 'm03', name: 'Star' }, { id: 'm01', name: 'Heart', s: 0.95 }, { id: 'c04', name: 'Chick bun' } ] },
  { key: 'plush', name: 'Beauty & Plush', icon: 'p04', items: [
    { id: 't04', name: 'Nail polish' }, { id: 'g02', name: 'Lipstick' }, { id: 'g13', name: 'Pom-pom' }, { id: 'g14', name: 'Bunny charm' },
    { id: 'g15', name: 'Teddy' }, { id: 'p01', name: 'Kitten' }, { id: 'p04', name: 'Bunny' }, { id: 'p03', name: 'Hamster' },
    { id: 'c01', name: 'Bunny puff' } ] },
];
export const ITEMS = PAGES.flatMap(p => p.items);
export const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// ten levels per chapter lean on one page, then everything mixes (endless, seeded)
export const CHAPTERS = [
  { name: 'Boba Bar', pool: PAGES[0].items.map(i => i.id) },
  { name: 'Fruit Garden', pool: PAGES[1].items.map(i => i.id) },
  { name: 'Beauty & Plush', pool: PAGES[2].items.map(i => i.id) },
  { name: 'Sweet Mix', pool: null },
];
export const chapterOf = lvl => Math.min(CHAPTERS.length - 1, Math.floor((lvl - 1) / 10));

// Meta: two rooms to decorate with stars (café first, then the dorm nook). [id, name, cost, x, z, size, yaw, y?]
export const ROOMS = [
  { key: 'cafe', name: 'Boba Café', wall: ['#d9b6ff', '#cba2f8'], floor: ['#ffb6d9', '#ffdcec'], decor: [
    ['h05', 'Cloud rug', 2, 0.2, 0.6, 3.6, 0],
    ['h09', 'Boba counter', 3, -2.0, -2.5, 2.9, 0.25],
    ['h10', 'Café table', 3, 1.9, -0.3, 2.6, -0.3],
    ['h06', 'Mushroom lamp', 3, -3.3, 0.9, 1.5, 0.4],
    ['h11', 'Cake display', 4, 2.6, -2.9, 1.7, -0.2],
    ['h07', 'Happy succulent', 4, 0.3, -3.4, 1.0, 0],
  ] },
  { key: 'dorm', name: 'Dorm Nook', wall: ['#ffc6e2', '#ffb3d6'], floor: ['#a9e9d2', '#d4f7ea'], decor: [
    ['h01', 'Cozy bed', 3, -2.1, -2.3, 3.3, 0.2],
    ['h02', 'Heart beanbag', 3, -2.9, 1.0, 1.9, 0.6],
    ['h04', 'Vanity', 4, 2.6, -2.7, 2.4, -0.35],
    ['h12', 'Cat tree', 4, 3.3, 0.6, 2.4, -0.5],
    ['g17', 'Big bunny', 5, 0.4, -3.3, 1.3, 0],
    ['h08', 'Wall shelf', 5, 0.4, -3.95, 1.9, 0, 2.3],
  ] },
];

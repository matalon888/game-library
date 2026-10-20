// The trinkets. Every id is an AI 3D model from assets/cozy/web (copied into ./assets/<id>.glb + ./assets/thumbs/<id>.webp).
// To add new pieces later (t09–t30): copy the .glb + thumb into ./assets and add a line here; add the id to a chapter
// pool if it belongs to a theme. Models are normalised (largest side 1, resting on y = 0), so no other tuning is needed;
// `s` is an optional size tweak (1 = default).
export const ITEMS = [
  // fruit, toys, beauty (t)
  { id: 't01', name: 'Apple' }, { id: 't02', name: 'Banana' }, { id: 't03', name: 'Strawberry' }, { id: 't04', name: 'Watermelon' },
  { id: 't05', name: 'Pineapple' }, { id: 't06', name: 'Lemon', s: 0.92 }, { id: 't07', name: 'Avocado' }, { id: 't08', name: 'Rubber duck' },
  // café food (f)
  { id: 'f01', name: 'Cappuccino' }, { id: 'f02', name: 'Croissant' }, { id: 'f03', name: 'Pancakes' }, { id: 'f04', name: 'Donut' },
  { id: 'f05', name: 'Macarons' }, { id: 'f06', name: 'Chocolate cake' }, { id: 'f07', name: 'Milkshake' }, { id: 'f08', name: 'Bubble tea' },
  { id: 'f09', name: 'Club sandwich' }, { id: 'f15', name: 'Smoothie' }, { id: 'f16', name: 'Waffle' }, { id: 'f17', name: 'Cinnamon roll' },
  // garden, tea, bakery (g)
  { id: 'g01', name: 'Sprout' }, { id: 'g02', name: 'Seedling' }, { id: 'g03', name: 'Daisy pot' }, { id: 'g04', name: 'Tulips' },
  { id: 'g07', name: 'Tea leaf' }, { id: 'g08', name: 'Tea bag' }, { id: 'g09', name: 'Teacup' }, { id: 'g10', name: 'Teapot' },
  { id: 'g11', name: 'Tea stand' }, { id: 'g12', name: 'Flour sack' }, { id: 'g13', name: 'Cupcake' }, { id: 'g14', name: 'Cake slice' },
  { id: 'g15', name: 'Strawberry cake' }, { id: 'g17', name: 'Garden basket' }, { id: 'g18', name: 'Treasure chest' },
  // gems and toys (m)
  { id: 'm01', name: 'Heart gem' }, { id: 'm02', name: 'Blue crystal' }, { id: 'm03', name: 'Star candy' }, { id: 'm04', name: 'Leaf gem' },
  { id: 'm05', name: 'Bubble gem' }, { id: 'm06', name: 'Amber gem' }, { id: 'm07', name: 'Bomb' }, { id: 'm08', name: 'Disco ball' },
  { id: 'm09', name: 'Toy rocket' }, { id: 'm10', name: 'Pinwheel' }, { id: 'm11', name: 'Crate' }, { id: 'm12', name: 'Ice cube' },
];
export const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// ten levels per chapter; each chapter leans on its pool, then the Grand Bazaar mixes everything (endless, seeded)
export const CHAPTERS = [
  { name: 'Fruit Stand', pool: ['t01', 't02', 't03', 't04', 't05', 't06', 't07', 't08'], felt: ['#9fdcc9', '#7cc7b2'], rim: '#ffd27a', icon: 't03' },
  { name: 'Café Corner', pool: ['f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f09', 'f15', 'f16', 'f17'], felt: ['#b9d7f7', '#94bdea'], rim: '#ffc37a', icon: 'f04' },
  { name: 'Tea Garden', pool: ['g01', 'g02', 'g03', 'g04', 'g07', 'g08', 'g09', 'g10', 'g11', 'g17'], felt: ['#f6c9d6', '#eaa9be'], rim: '#ffd27a', icon: 'g10' },
  { name: 'Bake Shop', pool: ['g12', 'g13', 'g14', 'g15', 'f02', 'f04', 'f05', 'f06', 'f17', 'f16'], felt: ['#cdbdf2', '#ac9be2'], rim: '#ffcf6a', icon: 'g13' },
  { name: 'Gem Box', pool: ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'g18'], felt: ['#a8e0f0', '#80c8e0'], rim: '#ffd87a', icon: 'm08' },
  { name: 'Grand Bazaar', pool: null, felt: ['#ffd6b0', '#f7b98c'], rim: '#ffe08a', icon: 'g18' },
];
export const chapterOf = lvl => Math.min(CHAPTERS.length - 1, Math.floor((lvl - 1) / 10));

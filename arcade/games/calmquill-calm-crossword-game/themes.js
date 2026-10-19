// Calmquill themed word lists — our own, hand-picked, kid-safe common words (3–7 letters). MIT.
// Each theme also names the painted scene it is set against (index into SCENES in game.js).
export const THEMES = [
  { name: 'Garden', icon: '🌷', scene: 7, words: 'rose tulip seed soil leaf root bloom petal hose rake weed bee worm stem grow daisy lily shed fern pot' },
  { name: 'Ocean', icon: '🌊', scene: 4, words: 'wave tide shell reef crab fish coral sand salt whale boat sail foam pearl seal kelp shore gull dolphin' },
  { name: 'Kitchen', icon: '🍳', scene: 2, words: 'pan pot spoon fork knife bowl cup plate oven stove whisk bake cook jar kettle toast ladle' },
  { name: 'Weather', icon: '⛅', scene: 0, words: 'rain snow wind cloud storm sun fog hail frost mist sky cold warm breeze heat ice drizzle thunder' },
  { name: 'Music', icon: '🎵', scene: 3, words: 'song note drum harp flute piano tune beat choir band bass horn chord sing lute banjo violin tempo' },
  { name: 'Forest', icon: '🌲', scene: 1, words: 'tree pine oak moss fern owl deer bark twig path log fox bear acorn birch trail cone elk' },
  { name: 'Tea Time', icon: '🫖', scene: 5, words: 'tea cup pot cake scone milk sugar honey lemon spoon mint brew jam cream saucer kettle toast bun' },
  { name: 'Stars', icon: '✨', scene: 6, words: 'star moon sun orbit comet mars sky night light space venus planet dust glow nova shine earth' },
  { name: 'Farm', icon: '🐄', scene: 7, words: 'cow pig hen barn goat sheep horse hay corn duck egg milk field lamb wheat mud fence tractor' },
  { name: 'Fruit Bowl', icon: '🍑', scene: 2, words: 'apple pear plum grape lemon lime peach melon mango kiwi berry cherry banana fig date orange' },
  { name: 'Travel', icon: '🧳', scene: 4, words: 'map bag trip road car train plane ticket hotel tour ship bus route pass camp guide travel' },
  { name: 'Sports', icon: '⚽', scene: 1, words: 'ball goal team race swim run kick golf bat net score win ski skate jump coach game match' },
  { name: 'Home', icon: '🏡', scene: 5, words: 'door roof wall room bed lamp sofa chair table rug sink desk stair window shelf clock home' },
  { name: 'Colours', icon: '🎨', scene: 3, words: 'red blue green pink gray gold tan teal lime rose plum navy white black brown amber ivory' },
  { name: 'Animals', icon: '🦊', scene: 1, words: 'cat dog lion tiger bear wolf fox owl frog mouse rabbit zebra horse panda koala otter deer seal' },
  { name: 'Bakery', icon: '🥐', scene: 2, words: 'bread bun cake pie roll flour sugar dough oven tart crust loaf bagel cookie muffin yeast' },
  { name: 'Seaside', icon: '🐚', scene: 4, words: 'beach sand wave pier kite towel shell crab gull hat swim boat dune sun tide surf' },
  { name: 'Night Sky', icon: '🌙', scene: 6, words: 'moon star owl dream sleep night dark comet glow quiet lamp bed rest calm hush' },
].map(t => ({ ...t, words: [...new Set(t.words.split(' '))] }));

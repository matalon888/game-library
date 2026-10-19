// Hero Lab catalog: every character and item, with the tags and fit presets the lab and hero.js use.
// Characters ship as ./assets/chars/<id>.glb (mesh + skeleton + idle/run/sprint/jump/slide/cheer/fall clips).
// Items with `alt` are code-built stand-ins, hidden once that generated GLB ships.
// Items are either a cropped GLB (./assets/items/<id>.glb, `glb: true`) or built in code (`proc`), see parts.js.

export const TAGS = [
  ['all', 'All'], ['heroes', 'Heroes'], ['villains', 'Villains'], ['sporty', 'Sporty'], ['animals', 'Animals'],
  ['creatures', 'Creatures'], ['robots', 'Robots'], ['fashion', 'Fashion'],
];

// colour per first tag, used for tile backgrounds and the stage rim light
export const TAG_COLOR = { heroes: '#3a86ff', villains: '#9b5cff', sporty: '#ff8a3d', animals: '#2ec27e', creatures: '#ff4d6d',
  robots: '#22c3e6', fashion: '#ff5dbb' };

export const CHARS = [
  { id: 'c01', name: 'Dunk Rico', role: 'Street baller', tags: ['sporty', 'heroes'] },
  { id: 'c02', name: 'Kickflip Kaia', role: 'Skater', tags: ['sporty', 'heroes'] },
  { id: 'c03', name: 'Sir Aldric', role: 'Paladin', tags: ['heroes'] },
  { id: 'c04', name: 'Morvex', role: 'Necromancer', tags: ['villains'] },
  { id: 'c05', name: 'Captain Scarla', role: 'Pirate captain', tags: ['villains', 'heroes'] },
  { id: 'c06', name: 'Nova Pip', role: 'Space explorer', tags: ['heroes'] },
  { id: 'c07', name: 'Rook', role: 'Fox ranger', tags: ['animals', 'heroes'] },
  { id: 'c08', name: 'Bao', role: 'Panda brawler', tags: ['animals', 'sporty'] },
  { id: 'c09', name: 'Emberscale', role: 'Dragon-kin', tags: ['creatures', 'heroes'] },
  { id: 'c10', name: 'Gizmo Grub', role: 'Goblin tinkerer', tags: ['creatures', 'villains'] },
  { id: 'c11', name: 'Unit Volt', role: 'Battle robot', tags: ['robots', 'heroes'] },
  { id: 'c12', name: 'Grukk', role: 'Orc warlord', tags: ['villains', 'creatures'] },
  { id: 'p01', name: 'Jaylen Drip', role: 'Streetwear', tags: ['fashion'] },
  { id: 'p02', name: 'Seoa Star', role: 'Pop idol', tags: ['fashion'] },
  { id: 'p03', name: 'Kage', role: 'Techwear', tags: ['fashion', 'heroes'] },
  { id: 'p04', name: 'Riot Roxy', role: 'Punk rocker', tags: ['fashion', 'villains'] },
  { id: 'p05', name: 'Granny Gloss', role: 'Style icon', tags: ['fashion'] },
  { id: 'p06', name: 'Kai Swell', role: 'Surfer', tags: ['fashion', 'sporty'] },
  { id: 'p07', name: 'Bijou', role: 'Y2K girl', tags: ['fashion'] },
  { id: 'p08', name: 'Mr Mustard', role: 'Gentleman', tags: ['fashion'] },
  { id: 'p09', name: 'DJ Hoopz', role: 'Hip-hop DJ', tags: ['fashion'] },
  { id: 'p10', name: 'Velvet Noir', role: 'Goth', tags: ['fashion', 'villains'] },
  { id: 'p11', name: 'Dash Neon', role: 'Runner', tags: ['fashion', 'sporty'] },
  { id: 'p12', name: 'Tex Rhinestone', role: 'Cowboy', tags: ['fashion'] },
  { id: 'p13', name: 'Holo Rae', role: 'Street racer', tags: ['fashion', 'sporty'] },
  { id: 'p14', name: 'Cozy Milo', role: 'Gamer', tags: ['fashion'] },
  { id: 'p15', name: 'Rouge', role: 'Runway model', tags: ['fashion'] },
  { id: 'p16', name: 'Blaze Harper', role: 'Firefighter', tags: ['fashion', 'heroes'] },
];

export const SLOTS = [
  { key: 'head', label: 'Head', icon: '🎩' },
  { key: 'face', label: 'Face', icon: '🕶️' },
  { key: 'back', label: 'Back', icon: '🪽' },
  { key: 'hand', label: 'Hands', icon: '🗡️' },
];

// fit presets (all relative to the measured body, see parts.js measure()):
//  head: w = width as a multiple of head width, sink = how far below the skull top the opening sits (× head height)
//  face: w = width × head width, dy = up/down (× head height), dz = forward (× head width)
//  back: w = width × torso width, dy = up/down (× torso height), dz = back/forward (× torso width)
//  hand: len = length × body height, dir = which way the tip points in rest pose, grip = 0..1 along the item
export const ITEMS = [
  // ---- head: generated GLB hats (cropped off their mannequins by tools/build-assets.mjs)
  { id: 'h01', slot: 'head', name: 'Street Cap', glb: true, tags: ['sporty'], fit: { w: 1.08, sink: 0.36, rotY: Math.PI } },
  { id: 'h02', slot: 'head', name: 'Pom Beanie', glb: true, tags: ['fashion'], fit: { w: 1.12, sink: 0.4 } },
  { id: 'h03', slot: 'head', name: 'Royal Crown', glb: true, tags: ['heroes'], fit: { w: 0.8, sink: 0.12 } },
  { id: 'h04', slot: 'head', name: 'Star Wizard', glb: true, tags: ['heroes'], fit: { w: 1.9, sink: 0.2 } },
  { id: 'h05', slot: 'head', name: 'Ranch Hat', glb: true, tags: ['fashion'], fit: { w: 2.0, sink: 0.26 } },
  { id: 'h06', slot: 'head', name: 'Viking Horns', glb: true, tags: ['villains'], fit: { w: 1.75, sink: 0.42 } },
  { id: 'h07', slot: 'head', name: 'Star Pilot', glb: true, tags: ['robots'], fit: { w: 1.45, sink: 1.0 } },
  { id: 'h08', slot: 'head', name: 'Skull Tricorn', glb: true, tags: ['villains'], fit: { w: 1.8, sink: 0.24 } },
  { id: 'h09', slot: 'head', name: 'Gamer Cans', glb: true, tags: ['fashion'], fit: { w: 1.3, sink: 0.78, dz: -0.15 } },
  { id: 'h10', slot: 'head', name: 'Kabuto', glb: true, tags: ['heroes'], fit: { w: 1.7, sink: 0.45 } },
  // ---- head: built in code
  { id: 'x_halo', slot: 'head', name: 'Halo', proc: 'halo', tags: ['heroes'] },
  { id: 'x_horns', slot: 'head', name: 'Devil Horns', proc: 'horns', tags: ['villains'] },
  { id: 'x_phones', slot: 'head', name: 'Bass Cans', proc: 'phones', alt: 'h09', tags: ['fashion'] },
  { id: 'x_bubble', slot: 'head', name: 'Space Bubble', proc: 'bubble', tags: ['robots'] },
  { id: 'x_band', slot: 'head', name: 'Sweatband', proc: 'band', tags: ['sporty'] },
  { id: 'x_party', slot: 'head', name: 'Party Cone', proc: 'party', tags: ['fashion'] },
  { id: 'x_ears', slot: 'head', name: 'Bunny Ears', proc: 'bunny', tags: ['animals'] },
  { id: 'x_antenna', slot: 'head', name: 'Bot Antenna', proc: 'antenna', tags: ['robots'] },
  // ---- face
  { id: 'f01', slot: 'face', name: 'Slick Shades', glb: true, tags: ['fashion'], fit: { w: 1.05 } },
  { id: 'f04', slot: 'face', name: 'Carnival Mask', glb: true, tags: ['fashion'], fit: { w: 1.0, dy: 0.12 } },
  { id: 'x_shades', slot: 'face', name: 'Cool Shades', proc: 'shades', alt: 'f01', tags: ['fashion'] },
  { id: 'x_round', slot: 'face', name: 'Round Specs', proc: 'specs', tags: ['heroes'] },
  { id: 'x_goggles', slot: 'face', name: 'Brass Goggles', proc: 'goggles', tags: ['creatures'] },
  { id: 'x_visor', slot: 'face', name: 'Neon Visor', proc: 'visor', tags: ['robots'] },
  { id: 'x_ninja', slot: 'face', name: 'Ninja Mask', proc: 'ninja', tags: ['villains'] },
  { id: 'x_masq', slot: 'face', name: 'Masquerade', proc: 'masq', alt: 'f04', tags: ['fashion'] },
  { id: 'x_patch', slot: 'face', name: 'Eye Patch', proc: 'patch', tags: ['villains'] },
  { id: 'x_stache', slot: 'face', name: 'Big Stache', proc: 'stache', tags: ['fashion'] },
  // ---- back
  { id: 'b01', slot: 'back', name: 'Rocket Pack', glb: true, tags: ['robots'], fit: { w: 1.7 } },
  { id: 'b02', slot: 'back', name: 'Seraph Wings', glb: true, tags: ['heroes'], fit: { w: 3.6, dy: 0.15 } },
  { id: 'b03', slot: 'back', name: 'Night Wings', glb: true, tags: ['villains'], fit: { w: 3.6, dy: 0.15 } },
  { id: 'b04', slot: 'back', name: 'Explorer Pack', glb: true, tags: ['sporty'], fit: { w: 1.2, rotY: Math.PI } },
  { id: 'b05', slot: 'back', name: 'Hunter Quiver', glb: true, tags: ['heroes'], fit: { w: 0.8, dy: 0.15 } },
  { id: 'x_jet', slot: 'back', name: 'Jetpack', proc: 'jetpack', alt: 'b01', tags: ['robots'] },
  { id: 'x_angel', slot: 'back', name: 'Angel Wings', proc: 'angel', alt: 'b02', tags: ['heroes'] },
  { id: 'x_bat', slot: 'back', name: 'Bat Wings', proc: 'bat', alt: 'b03', tags: ['villains'] },
  { id: 'x_pack', slot: 'back', name: 'Trail Pack', proc: 'pack', alt: 'b04', tags: ['sporty'] },
  { id: 'x_quiver', slot: 'back', name: 'Quiver', proc: 'quiver', alt: 'b05', tags: ['heroes'] },
  { id: 'x_cape', slot: 'back', name: 'Hero Cape', proc: 'cape', tags: ['heroes'] },
  { id: 'x_shell', slot: 'back', name: 'Turtle Shell', proc: 'shell', tags: ['animals'] },
  // ---- hands (shield goes to the off hand)
  { id: 'w01', slot: 'hand', name: 'Blue Gem Blade', glb: true, tags: ['heroes'], fit: { len: 1.05, grip: 0.12 }, hand: { tip: [0, -0.3, 1], face: [-1, 0, 0] } },
  { id: 'w05', slot: 'hand', name: 'Red Axe Guitar', glb: true, tags: ['fashion'], fit: { len: 1.0, grip: 0.72 }, hand: { tip: [0.15, 0.9, 0.45], face: [0, -0.3, 1] } },
  { id: 'w06', slot: 'hand', name: 'Zap Blaster', glb: true, tags: ['robots'], fit: { len: 0.32, grip: 0.3 }, hand: { tip: [0, 1, 0], face: [0, 0, 1], off: [0, 0, 0.03] } },
  { id: 'w07', slot: 'hand', name: 'Old Lantern', glb: true, tags: ['heroes'], fit: { len: 0.35, grip: 0.95 }, hand: { tip: [0, 1, 0], face: [0, 0, 1] } },
  { id: 'w03', slot: 'offhand', name: 'Emblem Shield', glb: true, tags: ['heroes'], fit: { len: 0.55, grip: 0.5 }, hand: { tip: [0, 1, 0], face: [-1, 0, 0.15], off: [-0.06, 0.02, 0] } },
  { id: 'w02', slot: 'hand', name: 'Serpent Staff', glb: true, tags: ['villains'], fit: { len: 1.45, grip: 0.42 }, hand: { tip: [0, 1, 0.06], face: [0, 0, 1] } },
  { id: 'w04', slot: 'hand', name: 'Graffiti Deck', glb: true, tags: ['sporty'], fit: { len: 0.78, grip: 0.5 }, hand: { tip: [0, 1, 0.1], face: [1, 0, 0], off: [-0.06, 0, 0] } },
  { id: 'x_sword', slot: 'hand', name: 'Gem Sword', proc: 'sword', alt: 'w01', tags: ['heroes'] },
  { id: 'x_staff', slot: 'hand', name: 'Crystal Staff', proc: 'staff', alt: 'w02', tags: ['heroes'] },
  { id: 'x_blaster', slot: 'hand', name: 'Toy Blaster', proc: 'blaster', alt: 'w06', tags: ['robots'] },
  { id: 'x_board', slot: 'hand', name: 'Skateboard', proc: 'board', alt: 'w04', tags: ['sporty'] },
  { id: 'x_guitar', slot: 'hand', name: 'Shred Guitar', proc: 'guitar', alt: 'w05', tags: ['fashion'] },
  { id: 'x_lantern', slot: 'hand', name: 'Lantern', proc: 'lantern', alt: 'w07', tags: ['heroes'] },
  { id: 'x_scythe', slot: 'hand', name: 'Grim Scythe', proc: 'scythe', tags: ['villains'] },
  { id: 'x_ball', slot: 'hand', name: 'Hoop Ball', proc: 'ball', tags: ['sporty'] },
  { id: 'x_shield', slot: 'offhand', name: 'Round Shield', proc: 'shield', alt: 'w03', tags: ['heroes'] },
];

export const CLIPS = ['idle', 'run', 'sprint', 'jump', 'slide', 'cheer', 'fall'];

export const NAMES_A = ['Turbo', 'Neon', 'Shadow', 'Pixel', 'Cosmic', 'Mega', 'Hyper', 'Lucky', 'Frost', 'Blaze', 'Ziggy', 'Captain', 'Lil', 'Rogue', 'Sunny', 'Jet'];
export const NAMES_B = ['Fox', 'Bolt', 'Nova', 'Rex', 'Moxie', 'Dash', 'Jinx', 'Comet', 'Biscuit', 'Ace', 'Echo', 'Waffles', 'Viper', 'Pop', 'Kit', 'Storm'];

export const charById = id => CHARS.find(c => c.id === id);
export const itemById = id => ITEMS.find(i => i.id === id);

// Bowtwist meta: Momo's dorm room, decorated with the stars you earn, and the sticker album (one sticker per win).
// Props are Kawaii Pop library pieces copied into ./assets (largest side = 1, standing on y = 0). Room units: the board
// is 7.4 wide, the ledge top is at y = -5.3, the floor at y = -15, the wall at z = -0.5.
export const TASKS = [
  { id: 'rug', name: 'Roll out the cloud rug', cost: 1, prop: 'h05', thumb: 'h05', s: 17, at: [-1, -15, 14], shadow: false },
  { id: 'lamp', name: 'Switch on the mushroom lamp', cost: 2, prop: 'h06', thumb: 'h06', s: 4.4, at: [-5.6, -5.3, 2.4], sd: 0.6 },
  { id: 'plant', name: 'Pot a happy succulent', cost: 2, prop: 'h07', thumb: 'h07', s: 3.4, at: [5.6, -5.3, 2.6] },
  { id: 'shelf', name: 'Hang the cute shelf', cost: 3, prop: 'h08', thumb: 'h08', s: 6.2, at: [9.6, -2.6, -0.2], shadow: false },
  { id: 'bean', name: 'Plop down a beanbag', cost: 3, prop: 'h02', thumb: 'h02', s: 7.6, at: [-7.6, -15, 11.5], ry: 0.45 },
  { id: 'bunny', name: 'Invite the big bunny', cost: 3, prop: 'g17', thumb: 'g17', s: 6.5, at: [6.8, -15, 12.5], ry: -0.5 },
  { id: 'plush', name: 'Pile up the plushies', cost: 4, prop: 'g18', thumb: 'g18', s: 6.2, at: [2.4, -15, 17.5], ry: -0.2 },
  { id: 'cat', name: 'Build the kitty tower', cost: 4, prop: 'h12', thumb: 'h12', s: 12, at: [-12.5, -15, 6], ry: 0.35 },
  { id: 'vanity', name: 'Set up the vanity', cost: 5, prop: 'h04', thumb: 'h04', s: 11, at: [13.5, -15, 3.5], ry: -0.3 },
  { id: 'desk', name: 'Bring the study desk', cost: 5, prop: 'h03', thumb: 'h03', s: 10.5, at: [-19.5, -15, 4], ry: 0.35 },
  { id: 'bed', name: 'Make the dreamy bed', cost: 6, prop: 'h01', thumb: 'h01', s: 15, at: [21, -15, 6], ry: -0.45 },
];
export const PAGES = [
  { id: 'sweets', name: 'Sweet Treats', ids: ['t01', 't02', 't03', 't05', 't06', 't07', 't08', 't09'] },
  { id: 'pets', name: 'Pet Pals', ids: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'g15', 'g16'] },
  { id: 'charms', name: 'Charm Club', ids: ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'b01', 'b02'] },
];
export const ALBUM = PAGES.flatMap(p => p.ids);

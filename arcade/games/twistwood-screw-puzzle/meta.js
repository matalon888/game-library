// Twistwood meta: Otto's workshop restoration (paid with stars) and the sticker album (one sticker per win).
// Props are AI 3D library pieces copied into ./assets (largest side = 1, standing on y = 0). Room units: the board is
// 7.4 wide, the bench top is at y = -5.3, the floor at y = -15, the wall at z = -0.5.
export const TASKS = [
  { id: 'rug', name: 'Roll out the rug', cost: 1, prop: 'h08', thumb: 'h08', s: 19, at: [-1, -15, 15], shadow: false },
  { id: 'lamp', name: 'Light the brass lamp', cost: 2, prop: 'h04', thumb: 'h04', s: 6.6, at: [-5.7, -5.3, 2.6], sd: 0.6 },
  { id: 'gramo', name: 'Wind up the gramophone', cost: 2, prop: 'h15', thumb: 'h15', s: 4.4, at: [5.7, -5.3, 2.8], ry: -0.5 },
  { id: 'paint', name: 'Hang the painting', cost: 3, prop: 'h16', thumb: 'h16', s: 6, at: [9.4, -1.6, -0.1], shadow: false },
  { id: 'plant', name: 'Pot the big monstera', cost: 3, prop: 'h05', thumb: 'h05', s: 8.5, at: [-7.4, -15, 11.5], ry: 0.4 },
  { id: 'chair', name: "Bring Otto's armchair", cost: 3, prop: 'h02', thumb: 'h02', s: 8.2, at: [6.6, -15, 12], ry: -0.55 },
  { id: 'cat', name: 'Wake Biscuit the cat', cost: 4, prop: 'h19', thumb: 'h19', s: 3.6, at: [2.6, -15, 16.5], ry: -0.3 },
  { id: 'table', name: 'Fresh flowers on the table', cost: 4, prop: 'h03', thumb: 'h03', s: 4.2, at: [-2.6, -15, 18.5] },
  { id: 'books', name: 'Fill the bookshelf', cost: 5, prop: 'h07', thumb: 'h07', s: 13, at: [15.5, -15, 3.2], ry: -0.2 },
  { id: 'clock', name: 'Wind the grandfather clock', cost: 5, prop: 'h10', thumb: 'h10', s: 15, at: [-17, -15, 2.5], ry: 0.25 },
  { id: 'chest', name: 'Open the treasure chest', cost: 6, prop: 'h21', thumb: 'h21', s: 4.6, at: [9.5, -15, 17.5], ry: -0.6 },
];
export const PAGES = [
  { id: 'orchard', name: 'Orchard', ids: ['t01', 't02', 't03', 't04', 't05', 't06', 't07', 't23'] },
  { id: 'toys', name: 'Toy Box', ids: ['t08', 't09', 't10', 't21', 't24', 't29', 't30', 't16'] },
  { id: 'vanity', name: 'Vanity', ids: ['t11', 't12', 't13', 't14', 't15', 't25', 't26', 't27'] },
];
export const ALBUM = PAGES.flatMap(p => p.ids);

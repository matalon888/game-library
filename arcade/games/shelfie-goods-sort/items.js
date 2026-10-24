// The goods (AI 3D library pieces from assets/cozy/web, copied into ./assets) and the three shops of Main Street.
// Each shop: its goods pool, the shelf look, and the décor you restore with stars on the home screen.
export const SHOPS = [
  {
    key: 'boutique', name: 'Boutique', sign: 'Boutique', icon: 't12',
    goods: [['t11', 'Lipstick'], ['t12', 'Perfume'], ['t13', 'Heels'], ['t14', 'Handbag'], ['t15', 'Heart shades'], ['t25', 'Nail polish'],
      ['t26', 'Hair dryer'], ['t27', 'Candle'], ['t18', 'Seashell'], ['t21', 'Gift box'], ['t24', 'Butterfly']],
    look: { frame: '#f7b8c8', trim: '#ffd27a', back: 'damask', backA: '#ffe9ee', backB: '#f9cdd9', shelf: '#fff3f0', liner: '#ffffff',
      wall: ['#ffe7e1', '#ffd9d2', '#ff9fb8'], floor: '#e9b48c', signBg: '#ff8fb0', signEdge: '#7a2f55', sky: '#f6d4cf' },
    decor: [
      { id: 's05', name: 'Gold mirror', cost: 2, at: [-6.4, 0, 0.6], size: 4.2, ry: 0.5 },
      { id: 'g05', name: 'Rose bouquet', cost: 2, at: [-3.0, 'top', -0.2], size: 1.5, ry: 0.2 },
      { id: 'h04', name: 'Brass lamp', cost: 2, at: [6.3, 0, -0.2], size: 4.4, ry: -0.3 },
      { id: 'h13', name: 'Vanity table', cost: 3, at: [-5.6, 0, 3.4], size: 3.0, ry: 0.7 },
      { id: 's02', name: 'Dress rack', cost: 3, at: [5.9, 0, 3.0], size: 3.6, ry: -0.6 },
      { id: 'h17', name: 'Chandelier', cost: 3, at: [0, 'ceil', 2.2], size: 2.2, ry: 0 },
    ],
  },
  {
    key: 'cafe', name: 'Café', sign: 'Café', icon: 'f04',
    goods: [['f01', 'Cappuccino'], ['f02', 'Croissant'], ['f03', 'Pancakes'], ['f04', 'Donut'], ['f05', 'Macarons'], ['f06', 'Choc cake'],
      ['f07', 'Milkshake'], ['f08', 'Bubble tea'], ['f15', 'Smoothie'], ['f16', 'Waffle'], ['f17', 'Cinnamon roll'], ['g09', 'Teacup'],
      ['g13', 'Cupcake'], ['g14', 'Cake slice'], ['t20', 'Ice cream']],
    look: { frame: '#9ed9c4', trim: '#ffd27a', back: 'subway', backA: '#f6fbf8', backB: '#cfe3da', shelf: '#e8c39a', liner: '#ffffff',
      wall: ['#e5f4ec', '#d6ece1', '#7cc7a8'], floor: '#d6a274', signBg: '#5fbf9c', signEdge: '#1f5e4a', sky: '#d9eee3' },
    decor: [
      { id: 'f10', name: 'Espresso machine', cost: 2, at: [3.0, 'top', -0.2], size: 1.6, ry: -0.3 },
      { id: 'f13', name: 'Menu board', cost: 2, at: [-6.3, 0, 0.8], size: 3.4, ry: 0.4 },
      { id: 'h05', name: 'Monstera', cost: 2, at: [6.4, 0, -0.2], size: 3.8, ry: -0.2 },
      { id: 'f12', name: 'Bistro table', cost: 3, at: [-5.5, 0, 3.6], size: 3.2, ry: 0.5 },
      { id: 'f14', name: 'Cash register', cost: 3, at: [-3.0, 'top', -0.2], size: 1.5, ry: 0.3 },
      { id: 'h08', name: 'Woven rug', cost: 3, at: [0.5, 0, 4.2], size: 6.0, ry: 0 },
    ],
  },
  {
    key: 'pantry', name: 'Pantry', sign: 'Pantry', icon: 'r23',
    goods: [['r21', 'Eggs'], ['r22', 'Bread'], ['r23', 'Honey'], ['r10', 'Pumpkin'], ['r20', 'Milk can'], ['t22', 'Carrot'], ['t01', 'Apple'],
      ['t23', 'Cherries'], ['t06', 'Lemon'], ['t03', 'Strawberry'], ['t05', 'Pineapple'], ['g12', 'Flour'], ['t07', 'Avocado'], ['t04', 'Watermelon'], ['t02', 'Banana']],
    look: { frame: '#c98d5e', trim: '#f4d9a8', back: 'gingham', backA: '#fffaf0', backB: '#eea39a', shelf: '#d9a26e', liner: '#ffffff',
      wall: ['#fff2dc', '#ffe6c4', '#e7a35e'], floor: '#c58b5c', signBg: '#e2735f', signEdge: '#6b2a1d', sky: '#f4dfc4' },
    decor: [
      { id: 'g17', name: 'Garden basket', cost: 2, at: [-3.0, 'top', -0.2], size: 1.4, ry: 0.3 },
      { id: 'h28', name: 'Lavender box', cost: 2, at: [6.2, 0, 0.4], size: 3.0, ry: -0.3 },
      { id: 'r19', name: 'Veggie crate', cost: 2, at: [-6.2, 0, 1.0], size: 2.6, ry: 0.4 },
      { id: 'h15', name: 'Gramophone', cost: 3, at: [3.0, 'top', -0.2], size: 1.6, ry: -0.4 },
      { id: 'h03', name: 'Flower table', cost: 3, at: [-5.4, 0, 3.8], size: 2.8, ry: 0.4 },
      { id: 'h10', name: 'Grandfather clock', cost: 3, at: [6.6, 0, 3.0], size: 4.6, ry: -0.5 },
    ],
  },
];
export const NAMES = {};
for (const s of SHOPS) for (const [id, n] of s.goods) NAMES[id] = n;
export const ALL_GOODS = SHOPS.flatMap(s => s.goods.map(g => g[0]));
// levels 1–8 boutique, 9–16 café, 17–24 pantry, then round again
export const shopOfLevel = n => SHOPS[Math.floor((n - 1) / 8) % SHOPS.length];
// per-item display tweaks: yaw (rad) so the long side runs along the shelf, size multiplier
export const POSE = { t13: { yaw: 1.35 }, t04: { yaw: 1.5 }, t02: { yaw: 1.45 }, f02: { yaw: 1.4 }, t15: { yaw: 0.1 }, r22: { yaw: 1.3 }, t26: { yaw: 1.2 },
  f04: { yaw: 0.25, s: 0.92 }, t24: { yaw: 0.15 }, t18: { yaw: 0.6 }, t14: { s: 1.05 } };

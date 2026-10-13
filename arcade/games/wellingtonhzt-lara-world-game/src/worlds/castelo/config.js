export const casteloDosDragoes = {
  id: 'castelo-dragoes',
  name: '\uD83D\uDC09 Castelo dos Drag\u00F5es',
  description: 'Atravesse muralhas m\u00E1gicas e encare os desafios dos drag\u00F5es!',
  icon: '\uD83D\uDC09',
  thumbnail: null,
  version: '1.0.0',
  type: 'main',
  metadata: {
    default: false,
    sortPriority: 5,
  },

  board: {
    totalCells: 20,
    startCell: 1,
    finishCell: 20,
    pathType: 'linear',
    cells: [
      { id: 1,  x: 10, y: 90 },
      { id: 2,  x: 26, y: 90 },
      { id: 3,  x: 42, y: 90 },
      { id: 4,  x: 58, y: 90 },
      { id: 5,  x: 74, y: 90 },
      { id: 6,  x: 74, y: 72 },
      { id: 7,  x: 58, y: 72 },
      { id: 8,  x: 42, y: 72 },
      { id: 9,  x: 26, y: 72 },
      { id: 10, x: 10, y: 72 },
      { id: 11, x: 10, y: 54 },
      { id: 12, x: 26, y: 54 },
      { id: 13, x: 42, y: 54 },
      { id: 14, x: 58, y: 54 },
      { id: 15, x: 74, y: 54 },
      { id: 16, x: 74, y: 36 },
      { id: 17, x: 58, y: 36 },
      { id: 18, x: 42, y: 36 },
      { id: 19, x: 26, y: 36 },
      { id: 20, x: 10, y: 18 },
    ],
    cellIcons: [
      '🏰', '⚔️', '⏩', '🕯️', '❓',
      '🛡️', '⏩', '📜', '🎲', '🗝️',
      '⏸️', '🧙', '🔮', '❓', '🐉',
      '⏩', '🏹', '🔄', '🏺', '🏆',
    ],
  },

  theme: {
    themeId: 'castelo-dragoes',
    cssClass: 'mundo-castelo',
    background: {
      type: 'gradient',
      value: 'linear-gradient(to bottom, #4a148c 0%, #6a1b9a 20%, #7b1fa2 45%, #4a148c 70%, #311b92 100%)',
    },
    colors: {
      primary: '#7b1fa2',
      secondary: '#ce93d8',
      accent: '#ffd700',
      background: '#311b92',
      text: '#f3e5f5',
      cellDefault: '#6a1b9a',
      cellSpecial: '#4a148c',
    },
    ambientEffect: { preset: 'rise', symbol: '◆', count: 5, color: '#ff8f00' },
    decorations: [
      { type: 'emoji', content: '\uD83C\uDFF0', className: 'deco-castle-1' },
      { type: 'emoji', content: '\uD83C\uDFF0', className: 'deco-castle-2' },
      { type: 'emoji', content: '\uD83D\uDC09', className: 'deco-dragon-1' },
      { type: 'emoji', content: '\uD83D\uDC09', className: 'deco-dragon-2' },
      { type: 'emoji', content: '\u2728', className: 'deco-sparkle-1' },
      { type: 'emoji', content: '\u2728', className: 'deco-sparkle-2' },
      { type: 'emoji', content: '\uD83C\uDF1F', className: 'deco-star-1' },
      { type: 'emoji', content: '\uD83D\uDD25', className: 'deco-fire-1' },
    ],
    music: { theme: null, portal: null, victory: null },
  },

  rules: {
    diceFaces: 6,
    passStartBonus: false,
    allowBackMovement: true,
    slipChance: 0,
    slipDelta: 0,
  },

  objectives: [
    { type: 'reachEnd', params: { cell: 20 }, label: 'Alcan\u00E7ar o topo do castelo!', optional: false },
  ],

  events: {
    3:  [{ type: 'move', params: { delta: 2 }, description: 'Avance 2' }],
    5:  [{ type: 'challenge', description: 'Desafio' }],
    7:  [{ type: 'move', params: { delta: -1 }, description: 'Volte 1' }],
    9:  [{ type: 'extraTurn', description: 'Jogue de novo' }],
    11: [{ type: 'skipTurn', params: { count: 1 }, description: 'Pule a vez' }],
    14: [{ type: 'challenge', description: 'Desafio' }],
    15: [{ type: 'ataque-dragoes', description: 'Dragões' }],
    16: [{ type: 'move', params: { delta: -2 }, description: 'Volte 2' }],
    18: [{ type: 'swap-positions', params: {}, description: 'Troque de lugar' }],
    20: [{ type: 'finishWorld', description: 'Chegada' }],
  },

  portals: [],

  // ── Question Policy ──

  questionPolicy: {
    categoryWeights: {
      logica: 30,
      conhecimentos_gerais: 25,
      matematica: 20,
      portugues: 15,
      dinossauros: 10,
    },
    levelRange: { min: 1, max: 3 },
  },

  assets: {
    backgrounds: { main: null, loading: null, victory: null, portal: null },
    sprites: {},
    sounds: { dice: null, move: null, portal: null, challenge: null, victory: null },
    music: { theme: null, portal: null, victory: null },
    ui: { icon: null, banner: null },
  },

  ui: {
    worldName: 'Castelo dos Drag\u00F5es',
    subtitle: 'Atravesse muralhas m\u00E1gicas e encare os desafios dos drag\u00F5es!',
    initialMessage: '\uD83D\uDC09 Bem-vindos ao Castelo dos Drag\u00F5es!',
    setupTitle: 'Preparar Aventura',
    worldIndicator: '\uD83D\uDC09 Castelo dos Drag\u00F5es',
    victoryTitle: 'Castelo Conquistado!',
  },

  customEventHandlers: {},
};

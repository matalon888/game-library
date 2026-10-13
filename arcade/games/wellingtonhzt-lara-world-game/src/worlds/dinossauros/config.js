export const valeDosDinossauros = {

  // ── Metadata ──

  id: 'dinossauros',
  name: '\uD83E\uDD96 Vale dos Dinossauros',
  description: 'Explore um vale pr\u00e9-hist\u00f3rico cheio de dinossauros, f\u00f3sseis e vulc\u00f5es ativos! Responda desafios, desvie de perigos e seja o primeiro a escapar!',
  icon: '\uD83E\uDD96',
  thumbnail: null,
  version: '1.0.0',
  type: 'main',
  metadata: {
    default: false,
    sortPriority: 2,
  },

  // ── Board ──

  board: {
    totalCells: 20,
    startCell: 1,
    finishCell: 20,
    pathType: 'linear',
    cells: [
      { id: 1,  x: 15, y: 12 },
      { id: 2,  x: 29, y: 10 },
      { id: 3,  x: 43, y: 12 },
      { id: 4,  x: 57, y: 10 },
      { id: 5,  x: 71, y: 12 },
      { id: 6,  x: 71, y: 34 },
      { id: 7,  x: 57, y: 32 },
      { id: 8,  x: 43, y: 34 },
      { id: 9,  x: 29, y: 32 },
      { id: 10, x: 15, y: 34 },
      { id: 11, x: 17, y: 54 },
      { id: 12, x: 31, y: 56 },
      { id: 13, x: 45, y: 54 },
      { id: 14, x: 59, y: 56 },
      { id: 15, x: 73, y: 54 },
      { id: 16, x: 73, y: 74 },
      { id: 17, x: 59, y: 76 },
      { id: 18, x: 45, y: 74 },
      { id: 19, x: 31, y: 76 },
      { id: 20, x: 17, y: 84 },
    ],
    cellIcons: [
      '🥚', '❓', '🦴', '⏩', '🌴',
      '⏪', '🌋', '🎲', '❓', '🏃',
      '⏪', '🐾', '❓', '🪨', '⏩',
      '🌱', '⏸️', '🦅', '❓', '🏆',
    ],
  },

  // ── Theme ──

  theme: {
    themeId: 'vale-dinossauros',
    cssClass: 'mundo-vale-dinossauros',
    background: {
      type: 'gradient',
      value: 'linear-gradient(to bottom, #f4e4c1 0%, #e8d5a3 30%, #c9a96e 60%, #8b6914 100%)',
    },
    colors: {
      primary: '#e65100',
      secondary: '#795548',
      accent: '#ff6f00',
      background: '#fff3e0',
      text: '#3e2723',
      cellDefault: '#fff8e1',
      cellSpecial: '#ffe0b2',
    },
    ambientEffect: { preset: 'drift', symbol: '•', count: 6, color: '#d7b77a' },
    decorations: [
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-1' },
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-2' },
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-3' },
      { type: 'emoji', content: '\uD83C\uDF24\uFE0F', className: 'deco-sun' },
      { type: 'emoji', content: '\uD83C\uDF34', className: 'deco-palm-1' },
      { type: 'emoji', content: '\uD83C\uDF34', className: 'deco-palm-2' },
      { type: 'emoji', content: '\uD83E\uDEA8', className: 'deco-rock-1' },
      { type: 'emoji', content: '\uD83E\uDEA8', className: 'deco-rock-2' },
      { type: 'emoji', content: '\uD83C\uDF0B', className: 'deco-volcano' },
      { type: 'emoji', content: '\uD83E\uDD96', className: 'deco-dino' },
    ],
    music: {
      theme: null,
      portal: null,
      victory: null,
    },
  },

  // ── Rules ──

  rules: {
    diceFaces: 6,
    passStartBonus: false,
    allowBackMovement: true,
    slipChance: 0,
    slipDelta: 0,
  },

  // ── Objectives ──

  objectives: [
    {
      type: 'reachEnd',
      params: { cell: 20 },
      label: 'Escapar do Vale dos Dinossauros!',
      optional: false,
    },
  ],

  // ── Events ──

  events: {
    2: [
      { type: 'challenge', description: 'Desafio' },
    ],
    4: [
      { type: 'move', params: { delta: 3 }, description: 'Avance 3' },
    ],
    6: [
      { type: 'move', params: { delta: -2 }, description: 'Volte 2' },
    ],
    8: [
      { type: 'extraTurn', description: 'Jogue de novo' },
    ],
      9: [
      { type: 'challenge', description: 'Desafio' },
    ],
     10: [
      { type: 'dino-runner', description: 'Dino Runner' },
    ],
    11: [
      { type: 'move', params: { delta: -4 }, description: 'Volte 4' },
    ],
    13: [
      { type: 'challenge', description: 'Desafio' },
    ],
    15: [
      { type: 'move', params: { delta: 1 }, description: 'Avance 1' },
    ],
    17: [
      { type: 'skipTurn', params: { count: 1 }, description: 'Pule a vez' },
    ],
    19: [
      { type: 'challenge', description: 'Desafio' },
    ],
    20: [
      { type: 'finishWorld', description: 'Chegada' },
    ],
  },

  // ── Portals ──

  portals: [],

  // ── Question Policy ──

  questionPolicy: {
    categoryWeights: {
      dinossauros: 35,
      natureza: 25,
      animais: 20,
      matematica: 10,
      portugues: 10,
    },
    levelRange: { min: 1, max: 3 },
  },

  // ── Assets ──

  assets: {
    backgrounds: {
      main: null,
      loading: null,
      victory: null,
      portal: null,
    },
    sprites: {},
    sounds: {
      dice: null,
      move: null,
      portal: null,
      challenge: null,
      victory: null,
    },
    music: {
      theme: null,
      portal: null,
      victory: null,
    },
    ui: {
      icon: null,
      banner: null,
    },
  },

  // ── UI ──

  ui: {
    worldName: 'Vale dos Dinossauros',
    subtitle: 'Aventura pr\u00e9-hist\u00f3rica espera por voc\u00ea!',
    initialMessage: '\uD83E\uDD96 Bem-vindos ao Vale dos Dinossauros!',
    setupTitle: 'Preparar Expedi\u00e7\u00e3o',
    worldIndicator: '\uD83C\uDF0B Vale dos Dinossauros',
    victoryTitle: 'Voc\u00ea escapou!',
  },

  // ── Custom Event Handlers ──

  customEventHandlers: {},
};


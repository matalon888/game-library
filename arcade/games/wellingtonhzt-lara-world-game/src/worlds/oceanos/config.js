export const reinoOceanos = {
  id: 'reino-oceanos',
  name: '\uD83C\uDF0A Reino dos Oceanos',
  description: 'Mergulhe no fundo do mar! Desvie de correntes, explore recifes de corais e seja o primeiro a chegar ao trono submarino!',
  icon: '\uD83C\uDF0A',
  thumbnail: null,
  version: '1.0.0',
  type: 'main',
  metadata: {
    default: false,
    sortPriority: 4,
  },

  board: {
    totalCells: 20,
    startCell: 1,
    finishCell: 20,
    pathType: 'linear',
    positions: {
       1: { x: 10, y: 10 },
       2: { x: 26, y: 10 },
       3: { x: 42, y: 10 },
       4: { x: 58, y: 10 },
       5: { x: 74, y: 10 },
       6: { x: 74, y: 28 },
       7: { x: 58, y: 28 },
       8: { x: 42, y: 28 },
       9: { x: 26, y: 28 },
      10: { x: 10, y: 28 },
      11: { x: 10, y: 46 },
      12: { x: 26, y: 46 },
      13: { x: 42, y: 46 },
      14: { x: 58, y: 46 },
      15: { x: 74, y: 46 },
      16: { x: 74, y: 64 },
      17: { x: 58, y: 64 },
      18: { x: 42, y: 64 },
      19: { x: 26, y: 64 },
      20: { x: 10, y: 82 },
    },
    cellIcons: [
      '🌊', '⏩', '🐙', '❓', '⏪',
      '🐠', '🪸', '🔄', '🎲', '🐢',
      '🐟', '❓', '🦈', '🐚', '🐋',
      '🎯', '⏸️', '❓', '🦞', '🏆',
    ],
  },

  theme: {
    themeId: 'reino-oceanos',
    cssClass: 'mundo-oceanos',
    background: {
      type: 'gradient',
      value: 'linear-gradient(to bottom, #0077be 0%, #005f9e 20%, #003d6b 45%, #002244 70%, #001122 100%)',
    },
    colors: {
      primary: '#0277bd',
      secondary: '#4fc3f7',
      accent: '#00e5ff',
      background: '#002244',
      text: '#e0f7fa',
      cellDefault: '#01579b',
      cellSpecial: '#004d6e',
    },
    ambientEffect: { preset: 'rise', symbol: '○', count: 7, color: '#b3e5fc' },
    decorations: [
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-1' },
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-2' },
      { type: 'emoji', content: '\uD83D\uDC33', className: 'deco-whale' },
      { type: 'emoji', content: '\uD83E\uDD80', className: 'deco-crab-1' },
      { type: 'emoji', content: '\uD83E\uDD80', className: 'deco-crab-2' },
      { type: 'emoji', content: '\uD83D\uDC19', className: 'deco-octopus' },
      { type: 'emoji', content: '\uD83E\uDEB8', className: 'deco-coral-1' },
      { type: 'emoji', content: '\uD83E\uDEB8', className: 'deco-coral-2' },
      { type: 'emoji', content: '\uD83D\uDC1F', className: 'deco-fish-1' },
      { type: 'emoji', content: '\uD83D\uDC1F', className: 'deco-fish-2' },
    ],
    music: {
      theme: null,
      portal: null,
      victory: null,
    },
  },

  rules: {
    diceFaces: 6,
    passStartBonus: false,
    allowBackMovement: true,
    slipChance: 0,
    slipDelta: 0,
  },

  objectives: [
    {
      type: 'reachEnd',
      params: { cell: 20 },
      label: 'Chegar ao trono submarino!',
      optional: false,
    },
  ],

  events: {
    2: [
      { type: 'move', params: { delta: 1 }, description: 'Avance 1' },
    ],
    4: [
      { type: 'challenge', description: 'Desafio' },
    ],
    5: [
      { type: 'move', params: { delta: -2 }, description: 'Volte 2' },
    ],
    8: [
      { type: 'swap-positions', params: {}, description: 'Troque de lugar' },
    ],
    9: [
      { type: 'extraTurn', description: 'Jogue de novo' },
    ],
    12: [
      { type: 'challenge', description: 'Desafio' },
    ],
    16: [
      { type: 'ocean-match3', description: 'Match-3' },
    ],
    17: [
      { type: 'skipTurn', params: { count: 1 }, description: 'Pule a vez' },
    ],
    18: [
      { type: 'challenge', description: 'Desafio' },
    ],
    20: [
      { type: 'finishWorld', description: 'Chegada' },
    ],
  },

  portals: [],

  // ── Question Policy ──

  questionPolicy: {
    categoryWeights: {
      natureza: 30,
      animais: 25,
      conhecimentos_gerais: 15,
      matematica: 15,
      portugues: 15,
    },
    levelRange: { min: 1, max: 3 },
  },

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

  ui: {
    worldName: 'Reino dos Oceanos',
    subtitle: 'Mergulhe nesta aventura subaqu\u00e1tica!',
    initialMessage: '\uD83C\uDF0A Bem-vindos ao Reino dos Oceanos!',
    setupTitle: 'Preparar Mergulho',
    worldIndicator: '\uD83C\uDF0A Reino dos Oceanos',
    victoryTitle: 'Oceanos Conquistados!',
  },

  customEventHandlers: {},
};

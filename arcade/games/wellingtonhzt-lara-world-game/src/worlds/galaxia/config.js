import { galaxyLayouts } from './layouts.js';

export const galaxiaEstelar = {
  id: 'galaxia-estelar',
  name: '\uD83C\uDF0C Gal\u00E1xia Estelar',
  description: 'Viaje pelo espa\u00E7o! Desvie de meteoros no Buraco de Minhoca e chegue ao fim da gal\u00E1xia!',
  icon: '\uD83C\uDF0C',
  thumbnail: null,
  version: '1.0.0',
  type: 'main',
  metadata: {
    default: false,
    sortPriority: 3,
  },

  board: {
    totalCells: 20,
    startCell: 1,
    finishCell: 20,
    pathType: 'linear',
    defaultLayout: 'padrao',
    layouts: galaxyLayouts,
    cellIcons: [
      '🌌', '🌍', '⏩', '💫', '❓',
      '🌙', '🔄', '🪐', '🎲', '🔭',
      '🛰️', '❓', '☄️', '⏪', '🚀',
      '⏸️', '🌟', '❓', '🌠', '🏆',
    ],
  },

  theme: {
    themeId: 'galaxia-estelar',
    cssClass: 'mundo-galaxia',
    background: {
      type: 'gradient',
      value: 'linear-gradient(to bottom, #0a0a2e 0%, #1a1a4e 25%, #0d0d3b 50%, #1a0a2e 75%, #0a0a1e 100%)',
    },
    colors: {
      primary: '#7c4dff',
      secondary: '#b388ff',
      accent: '#e040fb',
      background: '#0a0a2e',
      text: '#e0e0ff',
      cellDefault: '#1a1a4e',
      cellSpecial: '#2a1a5e',
    },
    ambientEffect: { preset: 'twinkle', symbol: '✦', count: 7, color: '#fff59d' },
    decorations: [
      { type: 'emoji', content: '\u2B50', className: 'deco-star-1' },
      { type: 'emoji', content: '\u2B50', className: 'deco-star-2' },
      { type: 'emoji', content: '\u2B50', className: 'deco-star-3' },
      { type: 'emoji', content: '\uD83C\uDF1F', className: 'deco-sun' },
      { type: 'emoji', content: '\uD83C\uDF1B', className: 'deco-moon' },
      { type: 'emoji', content: '\u2604\uFE0F', className: 'deco-comet-1' },
      { type: 'emoji', content: '\u2604\uFE0F', className: 'deco-comet-2' },
      { type: 'emoji', content: '\uD83C\uDF12', className: 'deco-planet-1' },
      { type: 'emoji', content: '\uD83D\uDE80', className: 'deco-rocket' },
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
      label: 'Chegar ao fim da gal\u00E1xia!',
      optional: false,
    },
  ],

  events: {
    3: [
      { type: 'move', params: { delta: 2 }, description: 'Avance 2' },
    ],
    5: [
      { type: 'challenge', description: 'Desafio' },
    ],
     7: [
        { type: 'swap-positions', params: {}, description: 'Troque de lugar' },
      ],
    9: [
      { type: 'extraTurn', description: 'Jogue de novo' },
    ],
    12: [
      { type: 'challenge', description: 'Desafio' },
    ],
    14: [
      { type: 'move', params: { delta: -3 }, description: 'Volte 3' },
    ],
    15: [
      { type: 'buraco-minhoca', description: 'Buraco de Minhoca' },
    ],
    16: [
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
      espaco: 40,
      logica: 20,
      conhecimentos_gerais: 20,
      matematica: 10,
      natureza: 10,
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
    worldName: 'Gal\u00E1xia Estelar',
    subtitle: 'Aventura nas estrelas!',
    initialMessage: '\uD83C\uDF0C Bem-vindos \u00E0 Gal\u00E1xia Estelar!',
    setupTitle: 'Preparar Miss\u00E3o Espacial',
    worldIndicator: '\uD83C\uDF0C Gal\u00E1xia Estelar',
    victoryTitle: 'Gal\u00E1xia Conquistada!',
  },

  customEventHandlers: {},
};

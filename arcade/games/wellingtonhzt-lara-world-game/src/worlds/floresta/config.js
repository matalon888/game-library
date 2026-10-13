// ── World: Floresta Encantada ──
//
// Primeiro mundo oficial da Engine Lara World.
// Define o mundo principal (tabuleiro de 20 casas).
// A casa 11 dispara o minigame Jogo da Memoria da Floresta.

export const florestaEncantada = {

  // ── Metadata ──

  id: 'floresta-encantada',
  name: '\uD83C\uDF33 Floresta Encantada',
  description: 'Aventure-se na floresta m\u00e1gica! Responda desafios, encontre portais e chegue ao final para vencer!',
  icon: '\uD83C\uDF33',
  thumbnail: null,
  version: '1.0.0',
  type: 'main',
  metadata: {
    default: true,
    sortPriority: 1,
  },

  // ── Board ──

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
      '🌳', '🍄', '⏩', '❓', '⏪',
      '🦋', '❓', '🎲', '🐞', '⏸️',
      '🧩', '❓', '🌻', '🍃', '🔙',
      '❓', '🌸', '❓', '🐾', '🏆',
    ],
  },

  // ── Theme ──

  theme: {
    themeId: 'floresta-encantada',
    cssClass: 'mundo-floresta-encantada',
    background: {
      type: 'gradient',
      value: 'linear-gradient(to bottom, #87ceeb 0%, #b5dffa 25%, #b5e8b5 55%, #7ec850 75%, #5daa3a 100%)',
    },
    colors: {
      primary: '#e91e63',
      secondary: '#a8845a',
      accent: '#f9a825',
      background: '#fff8f0',
      text: '#4a3520',
      cellDefault: '#fef7e6',
      cellSpecial: '#fff8e1',
    },
    ambientEffect: { preset: 'fall', symbol: '🍃', count: 6, color: '#66bb6a' },
    decorations: [
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-1' },
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-2' },
      { type: 'emoji', content: '\u2601\uFE0F', className: 'deco-cloud-3' },
      { type: 'emoji', content: '\uD83C\uDF24\uFE0F', className: 'deco-sun' },
      { type: 'emoji', content: '\uD83C\uDF33', className: 'deco-tree-1' },
      { type: 'emoji', content: '\uD83C\uDF32', className: 'deco-tree-2' },
      { type: 'emoji', content: '\uD83C\uDF37', className: 'deco-flower-1' },
      { type: 'emoji', content: '\uD83C\uDF3B', className: 'deco-flower-2' },
      { type: 'emoji', content: '\uD83C\uDF38', className: 'deco-flower-3' },
      { type: 'emoji', content: '\uD83C\uDF3A', className: 'deco-flower-4' },
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
      label: 'Chegar ao final do mundo!',
      optional: false,
    },
  ],

  // ── Events ──
  //
  // Mapa: casa → array de eventos
  // Os eventos são executados na ordem do array.
  // Eventos de movimento devem vir por último.

  events: {
    3: [
      { type: 'move', params: { delta: 2 }, description: 'Avance 2' },
    ],
    4: [
      { type: 'challenge', description: 'Desafio' },
    ],
    5: [
      { type: 'move', params: { delta: -1 }, description: 'Volte 1' },
    ],
    7: [
      { type: 'challenge', description: 'Desafio' },
    ],
    8: [
      { type: 'extraTurn', description: 'Jogue de novo' },
    ],
    10: [
      { type: 'skipTurn', params: { count: 1 }, description: 'Pule a vez' },
    ],
    11: [
      { type: 'memory-forest', description: 'Memória' },
    ],
    12: [
      { type: 'challenge', description: 'Desafio' },
    ],
    15: [
      { type: 'resetPosition', description: 'Volte ao início' },
    ],
    16: [
      { type: 'challenge', description: 'Desafio' },
    ],
    18: [
      { type: 'challenge', description: 'Desafio' },
    ],
    20: [
      { type: 'finishWorld', description: 'Chegada' },
    ],
  },

  // ── Portals ──
  //
  // Sem portais de submundo neste mundo.
  // A casa 11 utiliza o minigame Jogo da Memória.

  portals: [],

  // ── Question Policy ──
  //
  // Política de seleção de perguntas para este mundo.
  // O QuestionEngine usa categoryWeights para sortear perguntas temáticas.

  questionPolicy: {
    categoryWeights: {
      animais: 30,
      natureza: 25,
      cores_e_formas: 15,
      logica: 10,
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
    worldName: 'Floresta Encantada',
    subtitle: 'A aventura da Lara come\u00e7a aqui!',
    initialMessage: '\uD83C\uDFAE Bem-vindos ao Lara World!',
    setupTitle: 'Preparar Jogo',
    worldIndicator: '\uD83C\uDF3F Mundo da Floresta',
    victoryTitle: 'Vit\u00f3ria!',
  },
};

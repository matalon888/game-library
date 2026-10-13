import { registerMinigame, createDefaultLegacyProfile, getProfile } from '../engine/index.js';
import { OceanMatch3 } from './OceanMatch3.js';

const OCEAN_MATCH3_BASE = {
  id: 'ocean-match3',
  name: 'Tesouro das Marés',
  description: 'Combine peças marinhas para encontrar o tesouro!',
  icon: '\uD83C\uDF0A',
  iconAsset: new URL('../../assets/arcade/tesouro-mares.webp', import.meta.url).href,
  minPlayers: 1,
  maxPlayers: 1,
  botSuccessRate: 0.60,
  autoReturnSeconds: 5,
  presentation: {
    title: 'Tesouro das Marés',
    instruction: 'Clique em uma pe\u00E7a e depois em uma pe\u00E7a ao lado. Forme linhas de 3 iguais!',
    botMessage: 'A M\u00E1quina est\u00E1 procurando combina\u00E7\u00F5es no fundo do mar...',
    successIcon: '\uD83C\uDF1F',
    successTitle: 'Tesouro encontrado!',
    successMessage: 'Voc\u00EA criou combina\u00E7\u00F5es incr\u00EDveis!',
    failureIcon: '\uD83C\uDF0A',
    failureTitle: 'O tempo acabou',
    failureMessage: 'Voc\u00EA encontrou algumas combina\u00E7\u00F5es pelo caminho.'
  },
  rewards: {
    successBoardDelta: 3,
    failureBoardDelta: 0
  },
  create(options) {
    const { container, onComplete, context = 'board' } = options;
    const isArcade = context === 'arcade';
    const debugTime = OceanMatch3.debugTimeLimit;
    const noTimerLimit = debugTime === Infinity || isArcade;
    const game = new OceanMatch3(container, onComplete, {
      mode: isArcade ? 'arcade' : 'board',
      params: isArcade ? getProfile('ocean-match3', 'arcade') : undefined,
      timeLimit: noTimerLimit ? undefined : (debugTime || undefined),
      noTimerLimit
    });
    game.start();
    return game;
  },
  botPresentation: {
    start(instance) {
      if (instance && typeof instance.startBotPreview === 'function') {
        instance.startBotPreview();
      }
    },
    stop(instance) {
      if (instance && typeof instance.stopBotPreview === 'function') {
        instance.stopBotPreview();
      }
    }
  }
};

const OCEAN_MATCH3_ARCADE_PROFILE = {
  hasTimeLimit: false,
  minMovesToWin: 12,
  score: {
    perCombo: 10
  },
  difficulty: {
    stages: [
      { name: 'Est\u00E1gio 1', target: 5 },
      { name: 'Est\u00E1gio 2', target: 8 },
      { name: 'Est\u00E1gio 3', target: 12 }
    ]
  },
  presentation: {
    title: 'Tesouro das Mar\u00E9s Arcade',
    instruction: 'Complete os 3 est\u00E1gios de combina\u00E7\u00F5es. Cada est\u00E1gio pede mais combina\u00E7\u00F5es e cada cascata multiplica seus pontos!',
    failureIcon: '\uD83C\uDF0A',
    failureTitle: 'O oceano venceu',
    failureMessage: 'Tente novamente para bater seu recorde!'
  },
  resultStats: [
    { key: 'pontuacao', label: 'Pontua\u00E7\u00E3o', format: 'number', recordLabel: 'Melhor pontua\u00E7\u00E3o' },
    { key: 'combinacoes', label: 'Combina\u00E7\u00F5es', format: 'number', recordLabel: 'Recorde de combina\u00E7\u00F5es' },
    { key: 'cascatas', label: 'Cascatas', format: 'number', recordLabel: 'Recorde de cascatas' },
    { key: 'multiplicadorMax', label: 'Maior multiplicador', format: 'multiplier', recordLabel: 'Recorde de multiplicador' },
    { key: 'metasConcluidas', label: 'Metas concluídas', format: 'number', recordLabel: 'Recorde de metas' },
    { key: 'tempo', label: 'Tempo', format: 'seconds', recordLabel: 'Recorde de tempo' }
  ]
};

const OCEAN_MATCH3_CONFIG = Object.freeze({
  ...OCEAN_MATCH3_BASE,
  profiles: {
    board: createDefaultLegacyProfile(OCEAN_MATCH3_BASE),
    arcade: OCEAN_MATCH3_ARCADE_PROFILE
  }
});

registerMinigame(OCEAN_MATCH3_CONFIG);

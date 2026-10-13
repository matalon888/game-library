import { registerMinigame, createDefaultLegacyProfile, getProfile } from '../engine/index.js';
import { MemoryGame } from './MemoryGame.js';

let _cssLoaded = false;

function loadCSS() {
  if (_cssLoaded) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./memoryGame.css', import.meta.url).href;
  document.head.appendChild(link);
  _cssLoaded = true;
}

const MEMORY_FOREST_BASE = {
  id: 'memory-forest',
  name: 'Jogo da Mem\u00F3ria da Floresta',
  description: 'Encontre os pares de cartas da floresta!',
  icon: '\uD83C\uDF32',
  iconAsset: new URL('../../assets/arcade/memoria-floresta.webp', import.meta.url).href,
  minPlayers: 1,
  maxPlayers: 1,
  botSuccessRate: 0.65,
  autoReturnSeconds: 5,
  presentation: {
    title: 'Jogo da Mem\u00F3ria da Floresta',
    instruction: 'Encontre pelo menos 4 dos 6 pares de cartas da floresta!',
    botMessage: '\uD83E\uDD16 A m\u00E1quina est\u00E1 jogando o Jogo da Mem\u00F3ria...',
    successIcon: '\uD83C\uDF1F',
    successTitle: 'Mem\u00F3ria incr\u00EDvel!',
    successMessage: 'Voc\u00EA encontrou pares suficientes na floresta!',
    failureIcon: '\uD83C\uDF32',
    failureTitle: 'Tempo esgotado',
    failureMessage: 'Voc\u00EA encontrou alguns pares pelo caminho.'
  },
  rewards: {
    successBoardDelta: 3,
    failureBoardDelta: 0
  },
  create(options) {
    loadCSS();
    const { container, onComplete, context = 'board' } = options;
    const isArcade = context === 'arcade';
    const game = new MemoryGame(container, onComplete, isArcade ? {
      mode: 'arcade',
      params: getProfile('memory-forest', 'arcade')
    } : { mode: 'board' });
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

const MEMORY_FOREST_ARCADE_PROFILE = {
  hasTimeLimit: true,
  timeLimit: 45,
  pairCount: 8,
  score: { perPair: 100, timeBonusPerSecond: 10 },
  difficulty: { victoryPairs: 8 },
  presentation: {
    title: 'Memória da Floresta Arcade',
    instruction: 'Encontre todos os 8 pares antes do tempo acabar e ganhe pontos pelo tempo restante!',
    successTitle: 'Floresta memorizada!',
    successMessage: 'Você encontrou todos os pares!',
    failureTitle: 'Tempo esgotado',
    failureMessage: 'Tente novamente para encontrar todos os pares.'
  },
  resultStats: [
    { key: 'pontuacao', label: 'Pontuação', format: 'number', recordLabel: 'Melhor pontuação' },
    { key: 'paresEncontrados', label: 'Pares encontrados', format: 'number', recordLabel: 'Recorde de pares' },
    { key: 'tempo', label: 'Tempo restante', format: 'seconds', recordLabel: 'Melhor tempo restante' }
  ]
};

const MEMORY_FOREST_CONFIG = Object.freeze({
  ...MEMORY_FOREST_BASE,
  profiles: {
    board: createDefaultLegacyProfile(MEMORY_FOREST_BASE),
    arcade: MEMORY_FOREST_ARCADE_PROFILE
  }
});

registerMinigame(MEMORY_FOREST_CONFIG);

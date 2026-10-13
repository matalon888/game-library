import { registerMinigame, createDefaultLegacyProfile, getProfile } from '../engine/index.js';
import { AtaqueDragoesGame } from './AtaqueDragoesGame.js';

let _cssLoaded = false;

function loadCSS() {
  if (_cssLoaded) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./ataque-dragoes.css', import.meta.url).href;
  document.head.appendChild(link);
  _cssLoaded = true;
}

const ATAQUE_DRAGOES_BASE = {
  id: 'ataque-dragoes',
  name: 'Ataque dos Drag\u00F5es',
  description: 'Proteja o castelo dos drag\u00F5es travessos!',
  icon: '\uD83D\uDC09',
  iconAsset: new URL('../../assets/arcade/ataque-dragoes.webp', import.meta.url).href,
  minPlayers: 1,
  maxPlayers: 1,
  botSuccessRate: 0.55,
  autoReturnSeconds: 5,
  presentation: {
    title: 'Ataque dos Drag\u00F5es',
    instruction: 'Toque nos drag\u00F5es antes que alcancem o castelo!',
    botMessage: '\uD83E\uDD16 A M\u00E1quina est\u00E1 protegendo o castelo...',
    successIcon: '\uD83C\uDFF0',
    successTitle: 'Castelo protegido!',
    successMessage: 'Voc\u00EA afastou todos os drag\u00F5es!',
    failureIcon: '\uD83D\uDC09',
    failureTitle: 'Os drag\u00F5es foram r\u00E1pidos',
    failureMessage: 'Tente novamente para proteger o castelo!',
  },
  rewards: {
    successBoardDelta: 3,
    failureBoardDelta: 0,
  },
  create(options) {
    loadCSS();
    const { container, onComplete, context = 'board' } = options;
    const isArcade = context === 'arcade';
    const game = new AtaqueDragoesGame(container, onComplete, isArcade ? {
      mode: 'arcade', params: getProfile('ataque-dragoes', 'arcade')
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
    },
  },
};

const ATAQUE_DRAGOES_ARCADE_PROFILE = {
  hasTimeLimit: false,
  score: { perHit: 10, perSecond: 5 },
  difficulty: {
    stages: [
      { name: 'Inicial', until: 20, maxSimultaneous: 2, spawnInterval: 1.5, speed: 80 },
      { name: 'Rápido', until: 40, maxSimultaneous: 3, spawnInterval: 1.15, speed: 105 },
      { name: 'Intenso', until: 70, maxSimultaneous: 4, spawnInterval: 0.85, speed: 130 },
      { name: 'Cerco', until: null, maxSimultaneous: 5, spawnInterval: 0.65, speed: 155 }
    ]
  },
  presentation: {
    title: 'Ataque dos Dragões Arcade',
    instruction: 'Proteja o castelo pelo maior tempo possível. A partida termina quando os 3 escudos caem!',
    failureTitle: 'O cerco terminou',
    failureMessage: 'Tente novamente para superar sua pontuação!'
  },
  resultStats: [
    { key: 'pontuacao', label: 'Pontuação', format: 'number', recordLabel: 'Melhor pontuação' },
    { key: 'tempo', label: 'Tempo defendido', format: 'seconds', recordLabel: 'Recorde de tempo' },
    { key: 'acertos', label: 'Dragões afastados', format: 'number', recordLabel: 'Recorde de dragões' }
  ]
};

const ATAQUE_DRAGOES_CONFIG = Object.freeze({
  ...ATAQUE_DRAGOES_BASE,
  profiles: {
    board: createDefaultLegacyProfile(ATAQUE_DRAGOES_BASE),
    arcade: ATAQUE_DRAGOES_ARCADE_PROFILE
  }
});

registerMinigame(ATAQUE_DRAGOES_CONFIG);

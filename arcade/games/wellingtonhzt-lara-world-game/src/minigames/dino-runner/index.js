import { registerMinigame, createDefaultLegacyProfile, getProfile } from '../engine/index.js';
import { DinoRunnerGame } from './DinoRunnerGame.js';

const DINO_RUNNER_BASE = {
  id: 'dino-runner',
  name: 'Dino Runner',
  description: 'Corra com o dinossauro! Desvie dos obst\u00E1culos e sobreviva por 30 segundos.',
  icon: '\uD83E\uDD96',
  iconAsset: new URL('../../assets/arcade/dino-runner.webp', import.meta.url).href,
  minPlayers: 1,
  maxPlayers: 1,
  botSuccessRate: 0.40,
  autoReturnSeconds: 5,
  presentation: {
    title: 'Dino Runner',
    instruction: 'Pressione Espa\u00E7o, Seta para Cima ou clique para pular!',
    botMessage: 'A M\u00E1quina est\u00E1 correndo com o dinossauro...',
    successIcon: '\uD83E\uDD96',
    successTitle: 'Sobreviveu!',
    successMessage: 'O dinossauro escapou de todos os obst\u00E1culos!',
    failureIcon: '\uD83E\uDEA8',
    failureTitle: 'Fim da corrida',
    failureMessage: 'O dinossauro esbarrou em um obst\u00E1culo.'
  },
  rewards: {
    successBoardDelta: 3,
    failureBoardDelta: 0
  },
  create(options) {
    const { container, onComplete, context = 'board' } = options;
    const isArcade = context === 'arcade';
    const game = new DinoRunnerGame(container, (rawResult) => {
      onComplete(rawResult);
    }, isArcade ? {
      mode: 'arcade',
      params: getProfile('dino-runner', 'arcade')
    } : {
      mode: 'board'
    });
    game.start();
    return game;
  },
  botPresentation: {
    start() {},
    stop() {}
  }
};

const DINO_RUNNER_ARCADE_PROFILE = {
  hasTimeLimit: false,
  score: {
    perSecond: 10,
    perObstacle: 5
  },
  difficulty: {
    stages: [
      { name: 'Inicial', until: 20, speed: 1.0, spawnMin: 1.4, spawnMax: 1.4 },
      { name: 'R\u00E1pido', until: 40, speed: 1.15, spawnMin: 1.0, spawnMax: 1.4 },
      { name: 'Acelerado', until: 60, speed: 1.3, spawnMin: 0.85, spawnMax: 1.3 },
      { name: 'Intenso', until: 90, speed: 1.45, spawnMin: 0.7, spawnMax: 1.1 },
      { name: 'Insano', until: null, speed: 1.6, spawnMin: 0.55, spawnMax: 0.9 }
    ]
  },
  presentation: {
    title: 'Dino Runner Arcade',
    instruction: 'Sobreviva o m\u00E1ximo poss\u00EDvel! Pule com Espa\u00E7o, Seta para Cima ou clique.',
    failureIcon: '\uD83E\uDD96',
    failureTitle: 'Fim da corrida',
    failureMessage: 'Seu dinossauro colidiu. Tente bater seu recorde!'
  },
  resultStats: [
    { key: 'pontuacao', label: 'Pontua\u00E7\u00E3o', format: 'number', recordLabel: 'Melhor pontua\u00E7\u00E3o' },
    { key: 'tempo', label: 'Tempo sobrevivido', format: 'seconds', recordLabel: 'Recorde de tempo' },
    { key: 'obstaculosDesviados', label: 'Obst\u00E1culos desviados', format: 'number', recordLabel: 'Recorde de obst\u00E1culos' }
  ]
};

const DINO_RUNNER_CONFIG = Object.freeze({
  ...DINO_RUNNER_BASE,
  profiles: {
    board: createDefaultLegacyProfile(DINO_RUNNER_BASE),
    arcade: DINO_RUNNER_ARCADE_PROFILE
  }
});

registerMinigame(DINO_RUNNER_CONFIG);

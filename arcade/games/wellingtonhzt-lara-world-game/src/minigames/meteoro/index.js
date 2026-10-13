import { registerMinigame, createDefaultLegacyProfile, getProfile } from '../engine/index.js';
import { MeteoroGame } from './MeteoroGame.js';

const METEORO_BASE = {
  id: 'meteor-game',
  name: 'Chuva de Meteoros',
  description: 'Desvie dos meteoros coletando estrelas até acumular 3 acertos.',
  icon: '\uD83D\uDE80',
  iconAsset: new URL('../../assets/arcade/meteoros.webp', import.meta.url).href,
  minPlayers: 1,
  maxPlayers: 1,
  botSuccessRate: 0.40,
  autoReturnSeconds: 5,
  presentation: {
    title: 'Buraco de Minhoca',
    instruction: 'Desvie dos meteoros e sobreviva!',
    botMessage: 'A M\u00E1quina est\u00E1 atravessando a chuva de meteoros...',
    successIcon: '\uD83D\uDE80',
    successTitle: 'Miss\u00E3o conclu\u00EDda!',
    successMessage: 'Voc\u00EA atravessou a chuva de meteoros.',
    failureIcon: '\uD83D\uDCA5',
    failureTitle: 'Fim da miss\u00E3o',
    failureMessage: 'Sua nave sofreu muitos danos.'
  },
  rewards: {
    successBoardDelta: 3,
    failureBoardDelta: 0
  },
  create(options) {
    const { container, onComplete, context = 'board' } = options;
    const isArcade = context === 'arcade';
    const game = new MeteoroGame(container, (rawResult) => {
      onComplete(isArcade ? rawResult : adaptResult(rawResult));
    }, isArcade ? {
      mode: 'arcade',
      params: getProfile('meteor-game', 'arcade')
    } : {
      mode: 'board'
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

const METEORO_ARCADE_PROFILE = {
  hasTimeLimit: false,
  score: {
    perSecond: 10,
    perMeteoro: 5
  },
  difficulty: {
    stages: [
      { name: 'Inicial', until: 20, spawnInterval: 0.7, spawnExtraChance: 0.3, speed: 1.0, meteoroSize: 1.0 },
      { name: 'R\u00E1pido', until: 40, spawnInterval: 0.6, spawnExtraChance: 0.35, speed: 1.12, meteoroSize: 1.05 },
      { name: 'Acelerado', until: 60, spawnInterval: 0.5, spawnExtraChance: 0.4, speed: 1.25, meteoroSize: 1.1 },
      { name: 'Intenso', until: 90, spawnInterval: 0.42, spawnExtraChance: 0.45, speed: 1.4, meteoroSize: 1.18 },
      { name: 'Insano', until: null, spawnInterval: 0.35, spawnExtraChance: 0.5, speed: 1.55, meteoroSize: 1.25 }
    ]
  },
  presentation: {
    title: 'Chuva de Meteoros Arcade',
    instruction: 'Sobreviva o m\u00E1ximo poss\u00EDvel! Desvie dos meteoros com as setas ou arrastando a nave.',
    failureIcon: '\uD83D\uDE80',
    failureTitle: 'Fim da miss\u00E3o',
    failureMessage: 'Sua nave sofreu muitos danos. Tente bater seu recorde!'
  },
  resultStats: [
    { key: 'pontuacao', label: 'Pontua\u00E7\u00E3o', format: 'number', recordLabel: 'Melhor pontua\u00E7\u00E3o' },
    { key: 'tempo', label: 'Tempo sobrevivido', format: 'seconds', recordLabel: 'Recorde de tempo' },
    { key: 'meteorosDesviados', label: 'Meteoros desviados', format: 'number', recordLabel: 'Recorde de meteoros' }
  ]
};

const METEORO_CONFIG = Object.freeze({
  ...METEORO_BASE,
  profiles: {
    board: createDefaultLegacyProfile(METEORO_BASE),
    arcade: METEORO_ARCADE_PROFILE
  }
});

function adaptResult(raw) {
  const venceu = raw.status === 'success';
  return {
    venceu,
    boardDelta: venceu ? 3 : 0,
    progresso: {
      atual: venceu ? 3 : raw.lives ?? 0,
      objetivo: 3
    },
    motivo: venceu ? 'completo' : 'sem-vidas',
    stats: {
      vidasRestantes: raw.lives ?? 0,
      timeLeft: raw.timeLeft ?? 0,
      statusLegado: raw.status
    }
  };
}

registerMinigame(METEORO_CONFIG);

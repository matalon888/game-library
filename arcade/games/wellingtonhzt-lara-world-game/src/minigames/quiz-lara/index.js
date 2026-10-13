import { registerMinigame, getProfile } from '../engine/index.js';
import { QuizLaraGame } from './QuizLaraGame.js';
import { QUIZ_MODES } from './quiz-config.js';

let _cssLoaded = false;

function loadCSS() {
  if (_cssLoaded) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./quiz-lara.css', import.meta.url).href;
  document.head.appendChild(link);
  _cssLoaded = true;
}

const QUIZ_LARA_BASE = {
  id: 'quiz-lara',
  name: 'Quiz Lara World',
  description: 'Responda perguntas e acerte a maioria para vencer!',
  icon: '\u2753',
  iconAsset: new URL('../../assets/arcade/quiz-lara.webp', import.meta.url).href,
  minPlayers: 1,
  maxPlayers: 1,
  botSuccessRate: 0.5,
  autoReturnSeconds: 5,
  presentation: {
    title: 'Quiz Lara World',
    instruction: 'Acerte a maioria das perguntas para vencer!',
    successIcon: '\uD83C\uDF1F',
    successTitle: 'Quiz conclu\u00EDdo!',
    successMessage: 'Voc\u00EA acertou a maioria das perguntas!',
    failureIcon: '\uD83D\uDCA1',
    failureTitle: 'Continue praticando!',
    failureMessage: 'Acerte a maioria das perguntas na pr\u00F3xima rodada!'
  },
  rewards: {
    successBoardDelta: 3,
    failureBoardDelta: 0
  },
  create(options) {
    loadCSS();
    const { container, onComplete, context = 'board' } = options;
    const isArcade = context === 'arcade';
    const game = new QuizLaraGame(container, onComplete, isArcade ? {
      mode: 'arcade',
      params: getProfile('quiz-lara', 'arcade')
    } : { mode: 'board' });
    game.start();
    return game;
  }
};

const QUIZ_LARA_ARCADE_PROFILE = {
  hasTimeLimit: false,
  modes: QUIZ_MODES,
  score: {
    perCorrect: 100,
    streakBonusStep: 10,
    streakBonusCap: 100
  },
  victory: {
    rapido: 4,
    normal: 7,
    desafio: 10
  },
  presentation: {
    title: 'Quiz Lara World Arcade',
    instruction: 'Escolha um modo e uma categoria e acerte a maioria das perguntas para vencer!',
    successIcon: '\uD83C\uDF1F',
    successTitle: 'Quiz conclu\u00EDdo!',
    successMessage: 'Excelente! Voc\u00EA acertou a maioria das perguntas!',
    failureIcon: '\uD83D\uDCA1',
    failureTitle: 'Continue praticando!',
    failureMessage: 'Acerte a maioria das perguntas na pr\u00F3xima rodada!'
  },
  rewards: {
    successBoardDelta: 0,
    failureBoardDelta: 0
  },
  resultStats: [
    { key: 'score', label: 'Pontua\u00E7\u00E3o', format: 'number', recordLabel: 'Melhor pontua\u00E7\u00E3o' },
    { key: 'accuracy', label: 'Aproveitamento', format: 'percent', recordLabel: 'Melhor aproveitamento' },
    { key: 'bestStreak', label: 'Maior sequ\u00EAncia', format: 'number', recordLabel: 'Recorde de sequ\u00EAncia' }
  ]
};

const QUIZ_LARA_CONFIG = Object.freeze({
  ...QUIZ_LARA_BASE,
  profiles: {
    arcade: QUIZ_LARA_ARCADE_PROFILE
  }
});

registerMinigame(QUIZ_LARA_CONFIG);

// Textos/enredo como dado. Dono: narrative-designer.
// Tom arcade leve. Falas curtas para caber em 360px na fonte de fliperama.

export const STORY = {
  title: 'NEON VANGUARD',
  premise:
    'Última piloto da Vanguarda Neon. Atravesse o território inimigo e destrua o Núcleo ' +
    'que ameaça a colônia. Sem reforços. Só você e a nave.',

  stages: {
    stage1: { name: 'CINTURÃO DE ASTEROIDES', intro: 'FASE 1 // CINTURÃO DE ASTEROIDES', clear: 'SETOR LIMPO' },
    stage2: { name: 'FROTA INIMIGA',          intro: 'FASE 2 // FROTA INIMIGA',          clear: 'FROTA EM FUGA' },
    stage3: { name: 'NEBULOSA CARMESIM',      intro: 'FASE 3 // NEBULOSA CARMESIM',      clear: 'NÉVOA ATRAVESSADA' },
    stage4: { name: 'BASE ORBITAL',           intro: 'FASE 4 // BASE ORBITAL',           clear: 'BASE DESTRUÍDA' },
    stage5: { name: 'NÚCLEO FINAL',           intro: 'FASE 5 // NÚCLEO FINAL',           clear: 'NÚCLEO NEUTRALIZADO' },
  },

  bosses: {
    asteroidGuardian: [
      'GUARDIÃO: Você não passa daqui, piloto.',
      'GUARDIÃO: Impressionante... mas inútil!',
      'GUARDIÃO: Impossível!',
    ],
  },

  ui: {
    start: 'TOQUE / CLIQUE PARA COMEÇAR',
    pause: 'PAUSADO',
    gameOver: 'FIM DE JOGO',
    victory: 'VITÓRIA!',
    retry: 'TOQUE PARA TENTAR DE NOVO',
    hint: 'ARRASTE PARA MOVER · TIRO AUTOMÁTICO',
  },
};

export default STORY;

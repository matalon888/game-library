/**
 * quiz-config - Regras do Quiz Lara World.
 * Apenas dados e funções puras. Não depende de DOM nem de perguntas.
 */

export const QUIZ_MODES = Object.freeze([
  Object.freeze({
    id: 'rapido',
    label: 'Rápido',
    questionCount: 5,
    minCorrect: 4,
    description: '5 perguntas rápidas para aquecer.'
  }),
  Object.freeze({
    id: 'normal',
    label: 'Normal',
    questionCount: 10,
    minCorrect: 7,
    description: '10 perguntas para um desafio equilibrado.'
  }),
  Object.freeze({
    id: 'desafio',
    label: 'Desafio',
    questionCount: 15,
    minCorrect: 10,
    description: '15 perguntas para os mestres do Quiz.'
  })
]);

export const DEFAULT_MODE_ID = 'normal';

export const MIX_ALL_CATEGORY = '__todas__';

export const SCORE_PER_CORRECT = 100;

export const STREAK_BONUS_STEP = 10;

export const STREAK_BONUS_CAP = 100;

/**
 * Resolve o modo pelo id, com fallback seguro para o modo padrão.
 * @param {string} id
 * @returns {{ id: string, label: string, questionCount: number, minCorrect: number, description: string }}
 */
export function getMode(id) {
  return QUIZ_MODES.find(mode => mode.id === id) || QUIZ_MODES.find(mode => mode.id === DEFAULT_MODE_ID);
}

/**
 * Bônus de sequência de acertos consecutivos.
 * Sequência 2 => +20, 3 => +30, 4 => +40, crescendo com limite.
 * @param {number} streak
 * @returns {number}
 */
export function streakBonus(streak) {
  if (!Number.isFinite(streak) || streak < 2) return 0;
  return Math.min(streak * STREAK_BONUS_STEP, STREAK_BONUS_CAP);
}

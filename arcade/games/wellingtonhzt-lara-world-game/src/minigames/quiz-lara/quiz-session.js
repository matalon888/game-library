/**
 * quiz-session - Lógica pura do Quiz Lara World.
 * Seleção de perguntas, sessão de jogo e construção do resultado.
 * Não depende de DOM. Não conhece tabuleiro, jogadores nem sessões de partida.
 */

import { QuestionEngine } from '../../data/questions/index.js';
import { getMode, MIX_ALL_CATEGORY, SCORE_PER_CORRECT, streakBonus } from './quiz-config.js';

export const QUIZ_SELECTOR_SOURCE = QuestionEngine;

/**
 * Seleciona as perguntas de uma partida do Quiz.
 *
 * Anti-repetição com fallback seguro (nunca muda de categoria):
 * 1) tenta todas as perguntas compatíveis (níveis 1-3, categoria escolhida) sem repetir;
 * 2) se faltarem, reinicia o pool da PRÓPRIA categoria permitindo repetição;
 * 3) nunca troca de categoria silenciosamente;
 * 4) o uso do fallback é registrado no retorno.
 *
 * @param {object} options
 * @param {string} [options.mode] - id do modo (rapido | normal | desafio)
 * @param {string} [options.category] - categoria do CategoryCatalog ou MIX_ALL_CATEGORY
 * @param {object} [options.source] - fonte injetável com `selectMany(context, amount)` (padrão: QuestionEngine)
 * @returns {{ mode: object, category: string, questions: object[], requestedCount: number, obtainedCount: number, fallbackUsado: boolean }}
 */
export function pickQuizQuestions({ mode = 'normal', category = MIX_ALL_CATEGORY, source = QUIZ_SELECTOR_SOURCE } = {}) {
  const modeCfg = getMode(mode);
  const count = modeCfg.questionCount;

  const baseContext = { levelRange: { min: 1, max: 3 } };
  if (category && category !== MIX_ALL_CATEGORY) {
    baseContext.categoryWeights = { [category]: 1 };
  }

  const questions = [];
  const firstPass = source.selectMany({ ...baseContext }, count);
  questions.push(...firstPass);

  let fallbackUsado = false;
  if (questions.length < count) {
    fallbackUsado = true;
    const remaining = count - questions.length;
    const secondPass = source.selectMany({ ...baseContext, excludeIds: [] }, remaining);
    questions.push(...secondPass);
  }

  return {
    mode: modeCfg,
    category,
    questions,
    requestedCount: count,
    obtainedCount: questions.length,
    fallbackUsado
  };
}

/**
 * Sessão de uma partida do Quiz.
 * Guarda apenas o estado da partida em andamento e o resultado final.
 */
export class QuizSession {
  constructor({ questions, mode, category, categoryLabel, fallbackUsado = false }) {
    this.questions = questions;
    this.mode = mode;
    this.category = category;
    this.categoryLabel = categoryLabel;
    this.fallbackUsado = fallbackUsado;
    this.totalQuestions = questions.length;
    this.index = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.finished = false;
    this.lastAnswer = null;
  }

  get currentQuestion() {
    return this.questions[this.index] || null;
  }

  get progress() {
    return this.index;
  }

  get accuracy() {
    const answered = this.correctCount + this.wrongCount;
    return answered === 0 ? 0 : Math.round((this.correctCount / answered) * 100);
  }

  get isVictory() {
    return this.correctCount >= this.mode.minCorrect;
  }

  /**
   * Registra a resposta do índice selecionado. Não permite responder duas vezes
   * a mesma pergunta nem responder após o fim da partida.
   * @param {number} selectedIndex
   * @returns {object|null} resumo da resposta (ou null quando bloqueado)
   */
  answer(selectedIndex) {
    const question = this.currentQuestion;
    if (!question || this.finished) return null;

    const correct = question.correctOption === selectedIndex;
    let score = 0;
    let bonus = 0;

    if (correct) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      bonus = streakBonus(this.streak);
      score = SCORE_PER_CORRECT + bonus;
      this.score += score;
    } else {
      this.wrongCount++;
      this.streak = 0;
    }

    this.lastAnswer = {
      correct,
      correctIndex: question.correctOption,
      explanation: typeof question.explanation === 'string' ? question.explanation : '',
      bonus,
      score
    };

    this.index++;
    if (this.index >= this.questions.length) {
      this.finished = true;
    }
    return this.lastAnswer;
  }

  /**
   * Constrói o resultado normalizável pelo MinigameHost.
   * boardDelta é sempre 0: o Quiz nunca move o tabuleiro.
   * @returns {object}
   */
  buildResult() {
    return {
      venceu: this.isVictory,
      boardDelta: 0,
      progresso: {
        atual: Math.min(this.correctCount, this.mode.minCorrect),
        objetivo: this.mode.minCorrect
      },
      motivo: this.isVictory ? 'quiz-completo' : 'quiz-nao-concluido',
      stats: {
        score: this.score,
        correctAnswers: this.correctCount,
        wrongAnswers: this.wrongCount,
        accuracy: this.accuracy,
        bestStreak: this.bestStreak,
        totalQuestions: this.questions.length,
        category: this.categoryLabel,
        mode: this.mode.label
      }
    };
  }
}

/**
 * QuizLaraGame - Interface DOM do Quiz Lara World.
 * Estados: INTRO (escolha de modo/categoria) e pergunta a pergunta.
 * Ao terminar, o MinigameHost assume o card final de resultado e o retorno ao Arcade.
 */

import { audioManager } from '../../audio/index.js';
import { getCategories, getCategoryLabel } from '../../data/questions/category-catalog.js';
import { QUIZ_MODES, DEFAULT_MODE_ID, MIX_ALL_CATEGORY } from './quiz-config.js';
import { pickQuizQuestions, QuizSession } from './quiz-session.js';

const QUIZ_LETTERS = ['A', 'B', 'C'];

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class QuizLaraGame {
  constructor(container, onComplete, options = {}) {
    this.container = container;
    this.onComplete = onComplete;
    this.profile = (options && options.params) || {};
    this._rootEl = null;
    this._session = null;
    this._locked = false;
    this._destroyed = false;
    this._modeId = DEFAULT_MODE_ID;
    this._category = MIX_ALL_CATEGORY;
  }

  start() {
    if (this._destroyed) return;
    this.renderIntro();
  }

  destroy() {
    this._destroyed = true;
    this._session = null;
    this._clear();
  }

  _clear() {
    if (this._rootEl && this._rootEl.parentNode) {
      this._rootEl.parentNode.removeChild(this._rootEl);
    }
    this._rootEl = null;
  }

  _buildRoot() {
    this._clear();
    const root = document.createElement('div');
    root.className = 'quiz-lara';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Quiz Lara World');
    this.container.appendChild(root);
    this._rootEl = root;
    return root;
  }

  renderIntro() {
    const root = this._buildRoot();
    audioManager.play('challengeOpen');

    const modesHtml = QUIZ_MODES.map(mode => `
      <label class="quiz-mode-option">
        <input type="radio" name="quiz-mode" value="${mode.id}" ${mode.id === DEFAULT_MODE_ID ? 'checked' : ''}>
        <span class="quiz-mode-card">
          <span class="quiz-mode-name">${mode.label}</span>
          <span class="quiz-mode-count">${mode.questionCount} perguntas</span>
          <span class="quiz-mode-meta">${escapeHtml(mode.description)}</span>
        </span>
      </label>`).join('');

    const categories = getCategories();
    const categoryOptions = [
      `<option value="${MIX_ALL_CATEGORY}">Misturar tudo</option>`,
      ...categories.map(cat => `<option value="${cat}">${escapeHtml(getCategoryLabel(cat) || cat)}</option>`)
    ].join('');

    root.innerHTML = `
      <div class="quiz-intro">
        <div class="quiz-intro-icon">\u2753</div>
        <h2 class="quiz-intro-title">Quiz Lara World</h2>
        <p class="quiz-intro-desc">Escolha um modo e uma categoria e acerte a maioria das perguntas para vencer!</p>
        <fieldset class="quiz-field">
          <legend class="quiz-field-legend">Modo</legend>
          <div class="quiz-mode-list">${modesHtml}</div>
        </fieldset>
        <label class="quiz-field quiz-field-category">
          <span class="quiz-field-legend">Categoria</span>
          <select class="quiz-category-select" aria-label="Categoria das perguntas">${categoryOptions}</select>
        </label>
        <div class="quiz-intro-actions">
          <button type="button" class="quiz-btn quiz-btn-primary" data-action="start">Começar</button>
          <button type="button" class="quiz-btn quiz-btn-secondary" data-action="back">Voltar ao Arcade</button>
        </div>
      </div>`;

    const startBtn = root.querySelector('[data-action="start"]');
    const backBtn = root.querySelector('[data-action="back"]');
    const selectEl = root.querySelector('.quiz-category-select');

    startBtn.addEventListener('click', () => {
      audioManager.play('buttonClick');
      const selected = root.querySelector('input[name="quiz-mode"]:checked');
      if (selected) this._modeId = selected.value;
      this._category = selectEl ? selectEl.value : MIX_ALL_CATEGORY;
      this._startQuiz();
    });
    backBtn.addEventListener('click', () => this._backToArcade());

    startBtn.focus({ preventScroll: false });
  }

  _startQuiz() {
    if (this._destroyed) return;
    const picked = pickQuizQuestions({ mode: this._modeId, category: this._category });
    const categoryLabel = this._category === MIX_ALL_CATEGORY
      ? 'Misturar tudo'
      : (getCategoryLabel(this._category) || this._category);

    this._session = new QuizSession({
      questions: picked.questions,
      mode: picked.mode,
      category: this._category,
      categoryLabel,
      fallbackUsado: picked.fallbackUsado
    });

    if (picked.obtainedCount === 0) {
      this._finish();
      return;
    }
    this.renderQuestion();
  }

  renderQuestion() {
    const session = this._session;
    const question = session.currentQuestion;
    const root = this._buildRoot();

    const streakHtml = session.streak >= 2
      ? `<span class="quiz-hud-item quiz-streak">\uD83D\uDD25 Sequ\u00EAncia: ${session.streak}</span>`
      : '';

    root.innerHTML = `
      <div class="quiz-play">
        <div class="quiz-hud" aria-label="Placar do quiz">
          <span class="quiz-hud-item">Pergunta ${session.progress + 1} de ${session.totalQuestions}</span>
          <span class="quiz-hud-item">${escapeHtml(session.categoryLabel)}</span>
          <span class="quiz-hud-item">${session.score} pts</span>
          ${streakHtml}
        </div>
        <div class="quiz-progress" aria-hidden="true">
          <div class="quiz-progress-fill" style="width:${Math.round((session.progress / session.totalQuestions) * 100)}%"></div>
        </div>
        <div class="quiz-card">
          <p class="quiz-question-text">${escapeHtml(question.question)}</p>
          <div class="quiz-alternatives" role="group" aria-label="Escolha a resposta correta">
            ${question.options.map((option, index) => `
              <button type="button" class="quiz-alternative" data-index="${index}" aria-label="Alternativa ${QUIZ_LETTERS[index]}: ${escapeHtml(option)}">
                <span class="quiz-alternative-letter">${QUIZ_LETTERS[index]}</span>
                <span class="quiz-alternative-text">${escapeHtml(option)}</span>
              </button>`).join('')}
          </div>
          <div class="quiz-feedback hidden" aria-live="polite"></div>
          <div class="quiz-actions"></div>
        </div>
      </div>`;

    root.querySelectorAll('.quiz-alternative').forEach(btn => {
      btn.addEventListener('click', () => this._handleAnswer(Number(btn.dataset.index)));
    });

    this._locked = false;
    const firstOption = root.querySelector('.quiz-alternative');
    if (firstOption) firstOption.focus({ preventScroll: false });
  }

  _handleAnswer(index) {
    if (this._locked || !this._session) return;
    const session = this._session;
    const question = session.currentQuestion;
    if (!question) return;
    this._locked = true;

    const result = session.answer(index);
    if (!result) return;

    const root = this._rootEl;
    root.querySelectorAll('.quiz-alternative').forEach((btn, i) => {
      btn.disabled = true;
      if (i === result.correctIndex) {
        btn.classList.add('is-correct');
        btn.setAttribute('aria-pressed', 'true');
      } else if (i === index && !result.correct) {
        btn.classList.add('is-wrong');
      }
    });

    if (result.correct) {
      audioManager.play('correctAnswer');
    } else {
      audioManager.play('wrongAnswer');
    }

    const feedback = root.querySelector('.quiz-feedback');
    if (feedback) {
      let html = result.correct
        ? `<span class="quiz-feedback-status is-good">\u2713 Resposta correta!${result.bonus > 0 ? ` B\u00F4nus de sequ\u00EAncia +${result.bonus} pts!` : ''}</span>`
        : `<span class="quiz-feedback-status is-bad">\u2717 Resposta incorreta. A correta \u00E9 a alternativa ${QUIZ_LETTERS[result.correctIndex]}: ${escapeHtml(question.options[result.correctIndex])}.</span>`;
      if (result.explanation) {
        html += `<p class="quiz-feedback-explanation">${escapeHtml(result.explanation)}</p>`;
      }
      feedback.innerHTML = html;
      feedback.classList.remove('hidden');
    }

    const actions = root.querySelector('.quiz-actions');
    if (actions) {
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'quiz-btn quiz-btn-primary quiz-next-btn';
      nextBtn.textContent = session.finished ? 'Ver resultado' : 'Pr\u00F3xima pergunta';
      nextBtn.addEventListener('click', () => {
        audioManager.play('buttonClick');
        this._next();
      });
      actions.appendChild(nextBtn);
      nextBtn.focus({ preventScroll: false });
    }
  }

  _next() {
    if (this._destroyed || !this._session) return;
    if (this._session.finished) {
      this._finish();
    } else {
      this.renderQuestion();
    }
  }

  _finish() {
    if (this._destroyed || !this._session) return;
    const callback = this.onComplete;
    const result = this._session.buildResult();
    this._session = null;
    if (typeof callback === 'function') callback(result);
  }

  _backToArcade() {
    if (this._destroyed) return;
    audioManager.play('buttonClick');
    const callback = this.onComplete;
    const categoryLabel = this._category === MIX_ALL_CATEGORY
      ? 'Misturar tudo'
      : (getCategoryLabel(this._category) || this._category);
    const modeLabel = (QUIZ_MODES.find(mode => mode.id === this._modeId) || {}).label || 'Normal';
    if (typeof callback === 'function') {
      callback({
        venceu: false,
        boardDelta: 0,
        progresso: { atual: 0, objetivo: 0 },
        motivo: 'abandonou-o-quiz',
        stats: {
          score: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          accuracy: 0,
          bestStreak: 0,
          totalQuestions: 0,
          category: categoryLabel,
          mode: modeLabel
        }
      });
    }
  }
}

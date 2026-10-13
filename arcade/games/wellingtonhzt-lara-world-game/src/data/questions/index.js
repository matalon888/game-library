/**
 * QuestionEngine - Fachada pública do sistema de perguntas.
 * Auto-inicializa o banco durante o import.
 * Não mantém estado. Não conhece consumidores.
 */

import { allQuestions } from './bank/index.js';
import { register, findById as repoFindById, getAll, getByCategory, getBySubcategory, count as repoCount, getRegisteredCategories } from './question-repository.js';
import { select as selectorSelect, selectMany as selectorSelectMany } from './question-selector.js';
import { getCategories as catalogGetCategories, getSubcategories as catalogGetSubcategories } from './category-catalog.js';
import { validateBank } from './question-validator.js';

register(allQuestions);

/**
 * QuestionEngine - Fachada pública do sistema de perguntas.
 * Único export público do módulo.
 */
export const QuestionEngine = {
  /**
   * Seleciona uma pergunta usando SelectionContext.
   * @param {import('./question-selector.js').SelectionContext} [context]
   * @returns {object|null}
   */
  select(context) {
    return selectorSelect(getAll(), context);
  },

  /**
   * Seleciona N perguntas únicas usando SelectionContext.
   * @param {import('./question-selector.js').SelectionContext} [context]
   * @param {number} [amount=1]
   * @returns {object[]}
   */
  selectMany(context, amount = 1) {
    return selectorSelectMany(getAll(), amount, context);
  },

  /**
   * Busca pergunta por ID.
   * @param {string} id
   * @returns {object|null}
   */
  findById(id) {
    return repoFindById(id);
  },

  /**
   * Retorna categorias do catálogo.
   * @returns {string[]}
   */
  getCategories() {
    return catalogGetCategories();
  },

  /**
   * Retorna subcategorias de uma categoria.
   * @param {string} category
   * @returns {string[]}
   */
  getSubcategories(category) {
    return catalogGetSubcategories(category);
  },

  /**
   * Valida o banco completo. Retorna errors e warnings.
   * @returns {{ valid: boolean, errors: string[], warnings: string[], stats: object }}
   */
  validate() {
    return validateBank(getAll());
  },

  /**
   * Retorna estatísticas estruturais do banco.
   * @returns {object}
   */
  getStatistics() {
    const questions = getAll();
    const byCategory = {};
    const byLevel = {};

    for (const q of questions) {
      byCategory[q.category] = (byCategory[q.category] || 0) + 1;
      byLevel[q.level] = (byLevel[q.level] || 0) + 1;
    }

    const activeCount = questions.filter(q => q.active).length;
    const validation = validateBank(questions);

    return {
      totalQuestions: questions.length,
      activeQuestions: activeCount,
      byCategory,
      byLevel,
      validationErrors: validation.errors.length,
      validationWarnings: validation.warnings.length,
    };
  },
};

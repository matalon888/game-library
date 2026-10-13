/**
 * QuestionRepository - Armazenamento, indexação e localização de perguntas.
 * Não realiza sorteios. Não valida regras. Não conhece consumidores.
 *
 * Proteção contra mutação: todas as funções públicas que retornam objetos
 * criam cópias defensivas para evitar que consumidores corrompam o banco interno.
 */

const _byId = new Map();
const _byCategory = new Map();
const _bySubcategory = new Map();
const _byTag = new Map();
let _all = [];

/**
 * Cria uma cópia defensiva de uma pergunta.
 * Protege arrays internos (options, tags) contra mutação.
 * @param {object} q
 * @returns {object}
 */
function _copyQuestion(q) {
  return {
    id: q.id,
    category: q.category,
    subcategory: q.subcategory,
    question: q.question,
    options: [...q.options],
    correctOption: q.correctOption,
    explanation: q.explanation,
    level: q.level,
    tags: [...q.tags],
    active: q.active,
  };
}

/**
 * Registra perguntas no repositório.
 * Rejeita IDs duplicados.
 * @param {object[]} questions
 */
export function register(questions) {
  for (const q of questions) {
    if (_byId.has(q.id)) {
      throw new Error(`Duplicate question id: "${q.id}"`);
    }

    _byId.set(q.id, q);

    if (!_byCategory.has(q.category)) {
      _byCategory.set(q.category, []);
    }
    _byCategory.get(q.category).push(q);

    const subKey = `${q.category}::${q.subcategory}`;
    if (!_bySubcategory.has(subKey)) {
      _bySubcategory.set(subKey, []);
    }
    _bySubcategory.get(subKey).push(q);

    for (const tag of q.tags) {
      if (!_byTag.has(tag)) {
        _byTag.set(tag, new Set());
      }
      _byTag.get(tag).add(q.id);
    }

    _all.push(q);
  }
}

/**
 * Busca pergunta por ID.
 * Retorna cópia defensiva — consumidor não pode corromper o banco.
 * @param {string} id
 * @returns {object|null}
 */
export function findById(id) {
  const q = _byId.get(id);
  return q ? _copyQuestion(q) : null;
}

/**
 * Retorna todas as perguntas (cópia do array com objetos copiados).
 * @returns {object[]}
 */
export function getAll() {
  return _all.map(_copyQuestion);
}

/**
 * Retorna perguntas de uma categoria (cópia do array com objetos copiados).
 * @param {string} category
 * @returns {object[]}
 */
export function getByCategory(category) {
  return (_byCategory.get(category) || []).map(_copyQuestion);
}

/**
 * Retorna perguntas de uma subcategoria (cópia do array com objetos copiados).
 * @param {string} category
 * @param {string} subcategory
 * @returns {object[]}
 */
export function getBySubcategory(category, subcategory) {
  return (_bySubcategory.get(`${category}::${subcategory}`) || []).map(_copyQuestion);
}

/**
 * Retorna IDs de perguntas com uma tag.
 * @param {string} tag
 * @returns {string[]}
 */
export function getByTag(tag) {
  const set = _byTag.get(tag);
  return set ? [...set] : [];
}

/**
 * Retorna o total de perguntas registradas.
 * @returns {number}
 */
export function count() {
  return _all.length;
}

/**
 * Retorna categorias registradas.
 * @returns {string[]}
 */
export function getRegisteredCategories() {
  return [..._byCategory.keys()];
}

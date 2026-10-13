/**
 * CategoryCatalog - Hierarquia de categorias do banco de perguntas.
 * Define categorias, subcategorias e valida existência.
 * Não armazena perguntas. Não seleciona. Não conhece consumidores.
 */

const CATALOG = {
  matematica: {
    label: 'Matemática',
    subcategories: ['adicao', 'subtracao', 'multiplicacao', 'divisao', 'operacoes'],
  },
  portugues: {
    label: 'Português',
    subcategories: ['alfabeto', 'palavras', 'silabas', 'frases'],
  },
  animais: {
    label: 'Animais',
    subcategories: ['sons', 'caracteristicas', 'habitats', 'classificacao', 'geral'],
  },
  espaco: {
    label: 'Espaço',
    subcategories: ['planetas', 'estrelas', 'satelites', 'exploracao', 'galaxias', 'universo'],
  },
  natureza: {
    label: 'Natureza',
    subcategories: ['plantas', 'estacoes', 'habitats', 'animais', 'clima', 'estados', 'geografia', 'cores'],
  },
  dinossauros: {
    label: 'Dinossauros',
    subcategories: ['tipos', 'historia', 'alimentacao'],
  },
  logica: {
    label: 'Lógica',
    subcategories: ['operacoes', 'sequencias', 'formas', 'raciocinio', 'comparacao', 'contagem', 'opostos'],
  },
  cores_e_formas: {
    label: 'Cores e Formas',
    subcategories: ['cores', 'formas', 'mistura'],
  },
  conhecimentos_gerais: {
    label: 'Conhecimentos Gerais',
    subcategories: ['brasil', 'cultura', 'tempo', 'esportes', 'objetos', 'animais'],
  },
};

/**
 * Retorna todas as categorias registradas.
 * @returns {string[]}
 */
export function getCategories() {
  return Object.keys(CATALOG);
}

/**
 * Retorna as subcategorias de uma categoria.
 * @param {string} category
 * @returns {string[]}
 */
export function getSubcategories(category) {
  const entry = CATALOG[category];
  return entry ? [...entry.subcategories] : [];
}

/**
 * Verifica se uma categoria existe.
 * @param {string} category
 * @returns {boolean}
 */
export function hasCategory(category) {
  return category in CATALOG;
}

/**
 * Verifica se uma subcategoria existe dentro de uma categoria.
 * @param {string} category
 * @param {string} subcategory
 * @returns {boolean}
 */
export function hasSubcategory(category, subcategory) {
  const entry = CATALOG[category];
  return entry ? entry.subcategories.includes(subcategory) : false;
}

/**
 * Retorna o label de uma categoria.
 * @param {string} category
 * @returns {string|null}
 */
export function getCategoryLabel(category) {
  const entry = CATALOG[category];
  return entry ? entry.label : null;
}

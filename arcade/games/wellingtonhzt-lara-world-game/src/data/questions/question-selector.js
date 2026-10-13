/**
 * QuestionSelector - Seleciona perguntas usando SelectionContext.
 * Não armazena histórico. Não conhece jogadores, tabuleiro nem Quiz Show.
 */

/**
 * @typedef {object} SelectionContext
 * @property {object} [categoryWeights] - Pesos percentuais por categoria
 * @property {{ min?: number, max?: number }} [levelRange] - Faixa de nível
 * @property {string[]} [excludeIds] - IDs para excluir
 * @property {string[]} [tags] - Filtrar por tags
 * @property {string[]} [subcategories] - Filtrar por subcategoria
 */

const DEFAULT_CONTEXT = {
  categoryWeights: {},
  levelRange: { min: 1, max: 3 },
  excludeIds: [],
  tags: [],
  subcategories: [],
};

/**
 * Normaliza pesos: categorias com peso > 0 e finito participam.
 * Pesos são tratados como valores proporcionais (não precisam somar 100).
 * @param {object} weights
 * @returns {{ category: string, weight: number }[]}
 */
function normalizeWeights(weights) {
  if (!weights || typeof weights !== 'object') return [];
  return Object.entries(weights)
    .filter(([, w]) => typeof w === 'number' && w > 0 && Number.isFinite(w))
    .map(([category, weight]) => ({ category, weight }));
}

/**
 * Aplica pesos para construir um pool ponderado.
 * Cada pergunta aparece N vezes proporcional ao peso da categoria.
 * @param {object[]} pool
 * @param {{ category: string, weight: number }[]} weights
 * @returns {object[]}
 */
function buildWeightedPool(pool, weights) {
  if (weights.length === 0) return [...pool];

  const weightMap = new Map();
  for (const { category, weight } of weights) {
    weightMap.set(category, weight);
  }

  const result = [];
  for (const q of pool) {
    const w = weightMap.get(q.category) || 0;
    const copies = Number.isFinite(w) ? Math.ceil(w) : 0;
    for (let i = 0; i < copies; i++) {
      result.push(q);
    }
  }
  return result;
}

/**
 * Seleciona uma pergunta aleatoriamente do pool.
 * @param {object[]} pool
 * @returns {object|null}
 */
function randomPick(pool) {
  if (pool.length === 0) return null;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * Seleciona uma pergunta de acordo com o contexto.
 * @param {object[]} allQuestions - Todas as perguntas ativas do repositório
 * @param {SelectionContext} [context]
 * @returns {object|null}
 */
export function select(allQuestions, context = {}) {
  const ctx = { ...DEFAULT_CONTEXT, ...context };

  let pool = allQuestions.filter(q => q.active === true);

  if (ctx.levelRange && typeof ctx.levelRange.min === 'number') {
    pool = pool.filter(q => q.level >= ctx.levelRange.min);
  }
  if (ctx.levelRange && typeof ctx.levelRange.max === 'number') {
    pool = pool.filter(q => q.level <= ctx.levelRange.max);
  }

  if (Array.isArray(ctx.excludeIds) && ctx.excludeIds.length > 0) {
    const excluded = new Set(ctx.excludeIds);
    pool = pool.filter(q => !excluded.has(q.id));
  }

  if (Array.isArray(ctx.subcategories) && ctx.subcategories.length > 0) {
    const subSet = new Set(ctx.subcategories);
    pool = pool.filter(q => subSet.has(q.subcategory));
  }

  if (Array.isArray(ctx.tags) && ctx.tags.length > 0) {
    const tagSet = new Set(ctx.tags);
    pool = pool.filter(q => q.tags.some(t => tagSet.has(t)));
  }

  const weights = normalizeWeights(ctx.categoryWeights);
  const weightedPool = buildWeightedPool(pool, weights);

  return randomPick(weightedPool);
}

/**
 * Seleciona N perguntas únicas de acordo com o contexto.
 * Não repete IDs dentro do resultado.
 * @param {object[]} allQuestions
 * @param {number} amount
 * @param {SelectionContext} [context]
 * @returns {object[]}
 */
export function selectMany(allQuestions, amount, context = {}) {
  if (!Number.isFinite(amount) || amount <= 0) return [];

  const ctx = { ...DEFAULT_CONTEXT, ...context };
  const result = [];
  const usedIds = new Set(ctx.excludeIds || []);

  for (let i = 0; i < amount; i++) {
    const picked = select(allQuestions, { ...ctx, excludeIds: [...usedIds] });
    if (!picked) break;
    result.push(picked);
    usedIds.add(picked.id);
  }

  return result;
}

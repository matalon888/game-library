// Helpers puros de spawn. Dono: level-designer (formato) / phaser-programmer (consumo).

/** resolve a coordenada X de spawn a partir do campo spawnX da wave */
export function resolveSpawnX(spawnX, worldWidth, index = 0, count = 1) {
  if (typeof spawnX === 'number') return spawnX;
  if (Array.isArray(spawnX)) return spawnX[index % spawnX.length];
  switch (spawnX) {
    case 'center': return worldWidth / 2;
    case 'edges': return index % 2 === 0 ? worldWidth * 0.18 : worldWidth * 0.82;
    case 'spread':
    default: {
      const pad = worldWidth * 0.12;
      if (count <= 1) return worldWidth / 2;
      const span = worldWidth - pad * 2;
      return pad + (span * index) / (count - 1);
    }
  }
}

/** valida que uma fase tem o formato canônico (usado em teste e em runtime) */
export function validateLevel(level) {
  const errors = [];
  if (!level || typeof level !== 'object') return ['level inexistente'];
  if (!level.id) errors.push('faltando id');
  if (!Array.isArray(level.waves) || level.waves.length === 0) errors.push('faltando waves');
  (level.waves || []).forEach((w, i) => {
    if (!w.type && !w.enemy) errors.push(`wave ${i}: sem enemy nem type`);
    if (w.type === 'boss' && !w.boss) errors.push(`wave ${i}: boss sem id`);
    if (w.enemy && (w.count == null || w.count < 1)) errors.push(`wave ${i}: count inválido`);
  });
  return errors;
}

/** escala um valor base pelo multiplicador de dificuldade da fase */
export function scaleByDifficulty(base, scaleMap, phase) {
  const mult = scaleMap[phase] ?? 1;
  return base * mult;
}

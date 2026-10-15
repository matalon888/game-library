// Regras puras de combate. Dono: phaser-programmer (lógica testável).
// Sem Phaser aqui — só matemática/regras.

/** aplica dano e devolve o novo hp (>=0) */
export function applyDamage(hp, dmg) {
  return Math.max(0, hp - Math.max(0, dmg));
}

export function isDead(hp) {
  return hp <= 0;
}

/** sobe o nível de tiro respeitando o teto */
export function powerUpLevel(level, maxLevel) {
  return Math.min(maxLevel, level + 1);
}

/** ao tomar dano, cai 1 nível mas nunca abaixo de 1 (recuperação justa) */
export function powerDownLevel(level) {
  return Math.max(1, level - 1);
}

/** o player pode tomar dano? (não, se em i-frames ou com escudo) */
export function canTakeDamage(nowMs, invulnUntilMs, hasShield) {
  if (hasShield) return false;
  return nowMs >= invulnUntilMs;
}

/** pontuação por destruir um inimigo, com multiplicador de combo opcional */
export function scoreFor(baseScore, comboMult = 1) {
  return Math.round(baseScore * comboMult);
}

/** dado o nível de arma, retorna a lista de tiros (offsets/ângulos) */
export function shotsForLevel(weaponLevels, level) {
  return weaponLevels[level] || weaponLevels[1];
}

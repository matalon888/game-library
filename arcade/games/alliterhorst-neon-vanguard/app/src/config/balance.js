// TODOS os números de gameplay. Dono único: balance-designer.
// Nenhum outro arquivo deve conter número de gameplay cru.

export const BAL = {
  world: { width: 360, height: 640 },

  player: {
    maxHp: 3,                 // RATIFICADO: 3 pontos de vida
    lives: 2,                 // vidas extras iniciais
    speedLerp: 0.35,          // suavidade do follow do ponteiro (0-1)
    invulnMs: 1000,           // i-frames após dano
    fireRateMs: 220,          // cadência base do tiro automático
    bulletSpeed: 560,         // px/s (sobe na tela => negativo aplicado no código)
    bulletDamage: 1,
    bulletPoolSize: 64,
    hitRadius: 6,             // hitbox generosa-justa (menor que o sprite)
    maxPowerLevel: 5,
  },

  rapid:  { fireRateMs: 130, durationMs: 8000 },   // power-up cadência
  speed:  { lerpBonus: 0.15, durationMs: 8000 },   // power-up velocidade
  shield: { durationMs: 6000 },                    // absorve 1 hit / tempo
  bomb:   { damage: 8, startCount: 1 },            // dano em área a todos

  // power-up "power": evolui o trilho de tiro (nº de canos / spread)
  // ao tomar dano, cai 1 nível (não zera) — recuperação justa.
  weapon: {
    levels: {
      1: [{ angle: 0, dx: 0 }],
      2: [{ angle: 0, dx: -6 }, { angle: 0, dx: 6 }],
      3: [{ angle: 0, dx: 0 }, { angle: -10, dx: -7 }, { angle: 10, dx: 7 }],
      4: [{ angle: -6, dx: -9 }, { angle: -2, dx: -3 }, { angle: 2, dx: 3 }, { angle: 6, dx: 9 }],
      5: [{ angle: 0, dx: 0 }, { angle: -8, dx: -8 }, { angle: 8, dx: 8 }, { angle: -16, dx: -12 }, { angle: 16, dx: 12 }],
    },
  },

  enemyBullet: { speed: 230, damage: 1, poolSize: 128 },

  // multiplicador de dificuldade por fase (1..5). Curva suave.
  difficultyScale: { 1: 1.0, 2: 1.2, 3: 1.45, 4: 1.7, 5: 2.0 },

  // tetos anti-bullet-hell (bíblia: NÃO é bullet hell)
  caps: { maxEnemiesOnScreen: 18, maxEnemyBulletsOnScreen: 60 },

  spawn: {
    gapTight: 280, gapShort: 550, gapMedium: 900,
    restShort: 700, restMedium: 1400, restLong: 2200,
  },

  score: {
    grunt: 100, weaver: 150, turret: 200, diver: 180, hunter: 220, bomber: 250,
    boss: 5000, powerupPickupAtCap: 250,
  },

  powerupDropChance: 0.12, // chance de inimigo comum dropar power-up
};

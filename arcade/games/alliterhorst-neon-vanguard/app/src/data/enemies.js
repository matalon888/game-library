// Catálogo de inimigos. Dono: enemy-ai-designer.
// sprite = chave de textura gerada em TextureFactory. Números base (hp/fire) escalam por fase.

export const ENEMIES = {
  grunt: {
    sprite: 'enemy_grunt', hp: 2, pattern: 'straightDown',
    patternParams: { speed: 130 }, fireRateMs: 0, scoreKey: 'grunt', color: 'magenta',
  },
  weaver: {
    sprite: 'enemy_weaver', hp: 2, pattern: 'sine',
    patternParams: { speed: 90, amp: 100, freq: 2.6 }, fireRateMs: 0, scoreKey: 'weaver', color: 'purple',
  },
  turret: {
    sprite: 'enemy_turret', hp: 4, pattern: 'turret',
    patternParams: { speed: 80, holdY: 90 }, fireRateMs: 1500, scoreKey: 'turret', color: 'orange',
  },
  diver: {
    sprite: 'enemy_diver', hp: 2, pattern: 'dive',
    patternParams: { speed: 60, accel: 200 }, fireRateMs: 0, scoreKey: 'diver', color: 'orangeRed',
  },
  hunter: {
    sprite: 'enemy_hunter', hp: 3, pattern: 'hunter',
    patternParams: { speed: 70, descend: 45 }, fireRateMs: 2200, scoreKey: 'hunter', color: 'green',
  },
  bomber: {
    sprite: 'enemy_bomber', hp: 3, pattern: 'kamikaze',
    patternParams: { speed: 110, accel: 130 }, fireRateMs: 0, scoreKey: 'bomber', color: 'yellow',
  },
};

export function getEnemy(key) {
  return ENEMIES[key];
}

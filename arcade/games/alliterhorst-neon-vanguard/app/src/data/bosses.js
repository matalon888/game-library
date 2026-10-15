// Catálogo de bosses. Dono: enemy-ai-designer.
// Fases de ataque por % de HP (telegrafadas e justas — não é bullet hell).

export const BOSSES = {
  asteroidGuardian: {
    sprite: 'boss_1',
    name: 'GUARDIÃO DO CINTURÃO',
    hp: 60,
    moveAmp: 110,        // amplitude do vai-e-vem horizontal
    moveSpeed: 1.1,      // ritmo do vai-e-vem
    // fases por limiar de HP (de cima para baixo)
    phases: [
      { hpAbove: 0.66, attack: 'aimedTriple', fireRateMs: 1100, bulletSpeed: 210 },
      { hpAbove: 0.33, attack: 'spreadFan',   fireRateMs: 1300, bulletSpeed: 230 },
      { hpAbove: 0.0,  attack: 'circleBurst', fireRateMs: 1500, bulletSpeed: 240 },
    ],
  },
};

export function getBoss(key) {
  return BOSSES[key];
}

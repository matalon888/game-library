// Definições de SFX (sfxr-style, procedural 8-bit). Dono: sound-designer.
// Cada som é um conjunto de parâmetros renderizado uma vez em buffer (reprodutível).
export const SFX_DEFS = {
  shoot:       { type: 'square', f0: 880, f1: 440, dur: 0.10, attack: 0.001, decay: 0.09, vol: 0.18 },
  enemyShoot:  { type: 'square', f0: 320, f1: 180, dur: 0.12, attack: 0.001, decay: 0.11, vol: 0.16 },
  explodeSmall:{ type: 'noise',  f0: 600, f1: 80,  dur: 0.22, attack: 0.001, decay: 0.21, vol: 0.32 },
  explodeBig:  { type: 'noise',  f0: 400, f1: 40,  dur: 0.55, attack: 0.002, decay: 0.54, vol: 0.5 },
  powerup:     { type: 'square', f0: 520, f1: 1040,dur: 0.22, attack: 0.001, decay: 0.2, vol: 0.3, vibDepth: 0, slideUp: true },
  playerHit:   { type: 'saw',    f0: 300, f1: 60,  dur: 0.3,  attack: 0.001, decay: 0.29, vol: 0.4 },
  shield:      { type: 'sine',   f0: 220, f1: 660, dur: 0.25, attack: 0.005, decay: 0.24, vol: 0.3 },
  bossAlert:   { type: 'square', f0: 160, f1: 160, dur: 0.5,  attack: 0.01, decay: 0.49, vol: 0.35, vibDepth: 30, vibRate: 12 },
  uiClick:     { type: 'square', f0: 660, f1: 880, dur: 0.07, attack: 0.001, decay: 0.06, vol: 0.25 },
  gameOver:    { type: 'saw',    f0: 440, f1: 70,  dur: 0.9,  attack: 0.01, decay: 0.89, vol: 0.4 },
};

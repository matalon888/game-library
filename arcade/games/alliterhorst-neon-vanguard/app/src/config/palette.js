// Paleta oficial NEON VANGUARD (16 cores). Dono: pixel-artist.
// Strings hex para CSS/texto e números 0x para Phaser.

export const PALETTE = {
  bgDeep:    '#0d0221',
  bgMid:     '#190a3a',
  cyan:      '#21f0ff',
  cyanDark:  '#0bb8c9',
  magenta:   '#ff2e88',
  magDark:   '#c8186e',
  purple:    '#9d4edd',
  green:     '#39ff14',
  greenDark: '#1f9e2c',
  yellow:    '#ffd400',
  orange:    '#ff7b00',
  orangeRed: '#ff3c00',
  white:     '#f2f2ff',
  gray:      '#7a7a99',
  red:       '#ff0040',
  black:     '#05010f',
};

/** versão numérica (0xRRGGBB) para APIs do Phaser */
export const HEX = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, parseInt(v.slice(1), 16)])
);

// Regra de leitura fixa (bíblia §3): balas do player ciano/branco; inimigas magenta/laranja.
export const READ_RULES = {
  playerBullet: HEX.cyan,
  playerBulletAlt: HEX.white,
  enemyBullet: HEX.magenta,
  enemyBulletAlt: HEX.orange,
};

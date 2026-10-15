// Gera todas as texturas por código (placeholders neon nítidos). Dono temporário: pixel-artist.
// Zero asset externo => roda offline. Substituível por PNGs reais depois.
import { HEX } from '../config/palette.js';

function gfx(scene) {
  return scene.make.graphics({ x: 0, y: 0, add: false });
}

/** desenha um polígono preenchido com contorno mais claro (look neon) */
function neonPoly(g, points, fill, line) {
  g.fillStyle(fill, 1);
  g.lineStyle(2, line, 1);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

export function createTextures(scene) {
  // ---- PLAYER (nave triangular ciano, 28x28) ----
  let g = gfx(scene);
  neonPoly(g, [{ x: 14, y: 0 }, { x: 26, y: 26 }, { x: 14, y: 20 }, { x: 2, y: 26 }], HEX.cyanDark, HEX.cyan);
  g.fillStyle(HEX.white, 1); g.fillRect(12, 8, 4, 10);
  g.generateTexture('player', 28, 28); g.destroy();

  // ---- BALA DO PLAYER (ciano/branco, 6x16) ----
  g = gfx(scene);
  g.fillStyle(HEX.cyan, 1); g.fillRect(0, 0, 6, 16);
  g.fillStyle(HEX.white, 1); g.fillRect(2, 0, 2, 16);
  g.generateTexture('bullet_player', 6, 16); g.destroy();

  // ---- BALA INIMIGA (magenta/laranja, 8x8 losango) ----
  g = gfx(scene);
  neonPoly(g, [{ x: 4, y: 0 }, { x: 8, y: 4 }, { x: 4, y: 8 }, { x: 0, y: 4 }], HEX.magenta, HEX.orange);
  g.generateTexture('bullet_enemy', 8, 8); g.destroy();

  // ---- INIMIGOS (20x20 cada) ----
  const enemyShapes = {
    enemy_grunt: (gg) => neonPoly(gg, [{ x: 2, y: 2 }, { x: 18, y: 2 }, { x: 10, y: 18 }], HEX.magDark, HEX.magenta),
    enemy_weaver: (gg) => neonPoly(gg, [{ x: 10, y: 1 }, { x: 19, y: 10 }, { x: 10, y: 19 }, { x: 1, y: 10 }], HEX.purple, HEX.cyan),
    enemy_turret: (gg) => { gg.fillStyle(HEX.orange, 1); gg.fillRect(2, 4, 16, 14); gg.lineStyle(2, HEX.yellow, 1); gg.strokeRect(2, 4, 16, 14); gg.fillStyle(HEX.yellow, 1); gg.fillRect(8, 0, 4, 6); },
    enemy_diver: (gg) => neonPoly(gg, [{ x: 10, y: 19 }, { x: 18, y: 4 }, { x: 10, y: 9 }, { x: 2, y: 4 }], HEX.orangeRed, HEX.yellow),
    enemy_hunter: (gg) => { gg.fillStyle(HEX.greenDark, 1); gg.fillRect(2, 6, 16, 8); neonPoly(gg, [{ x: 0, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 14 }, { x: 0, y: 14 }], HEX.green, HEX.green); neonPoly(gg, [{ x: 14, y: 6 }, { x: 20, y: 6 }, { x: 20, y: 14 }, { x: 14, y: 14 }], HEX.green, HEX.green); },
    enemy_bomber: (gg) => { gg.fillStyle(HEX.yellow, 1); gg.fillCircle(10, 10, 9); gg.fillStyle(HEX.orangeRed, 1); gg.fillCircle(10, 10, 4); },
  };
  for (const [key, draw] of Object.entries(enemyShapes)) {
    g = gfx(scene); draw(g); g.generateTexture(key, 20, 20); g.destroy();
  }

  // ---- BOSS (124x96) ----
  g = gfx(scene);
  g.fillStyle(HEX.magDark, 1); g.fillRoundedRect(6, 10, 112, 60, 12);
  g.lineStyle(3, HEX.magenta, 1); g.strokeRoundedRect(6, 10, 112, 60, 12);
  g.fillStyle(HEX.purple, 1); g.fillRect(20, 64, 84, 18);
  g.fillStyle(HEX.cyan, 1); g.fillCircle(40, 40, 8); g.fillCircle(84, 40, 8);
  g.fillStyle(HEX.orangeRed, 1); g.fillCircle(62, 44, 10);
  g.generateTexture('boss_1', 124, 96); g.destroy();

  // ---- POWER-UPS (16x16) com letra ----
  const pu = {
    pu_power: HEX.cyan, pu_rapid: HEX.green, pu_shield: HEX.purple,
    pu_speed: HEX.yellow, pu_bomb: HEX.orangeRed, pu_life: HEX.magenta,
  };
  for (const [key, color] of Object.entries(pu)) {
    g = gfx(scene);
    g.fillStyle(HEX.black, 1); g.fillRect(0, 0, 16, 16);
    g.lineStyle(2, color, 1); g.strokeRect(1, 1, 14, 14);
    g.fillStyle(color, 1); g.fillRect(4, 4, 8, 8);
    g.generateTexture(key, 16, 16); g.destroy();
  }

  // ---- PARTÍCULA (4x4 quadrado branco — recolorida em runtime) ----
  g = gfx(scene);
  g.fillStyle(HEX.white, 1); g.fillRect(0, 0, 4, 4);
  g.generateTexture('particle', 4, 4); g.destroy();

  // ---- ESTRELA do parallax (2x2) ----
  g = gfx(scene);
  g.fillStyle(HEX.white, 1); g.fillRect(0, 0, 2, 2);
  g.generateTexture('star', 2, 2); g.destroy();
}

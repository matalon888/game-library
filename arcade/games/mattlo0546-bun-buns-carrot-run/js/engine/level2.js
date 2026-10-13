/**
 * Level 2: Night Kingdom  (300 cols)
 * Underground 2: Lava Cavern bonus area
 */
import S from './state.js';
import {
  T, LEVEL_H,
  BRICK, QCARROT, QLEEK, QKUMA, QMIKU, QYOSHI, STONE, LAVA, EMPTY,
  YPTL, YPTR, YPBL, YPBR,
  Q1UP, QSTAR,
} from './constants.js';
import {
  ground, blk, pipe, yellowPipe, stair,
  fox, koopa, carrot, initTileGrid,
} from './level-helpers.js';

// =========================
//  Level 2: Night Kingdom
// =========================

export function buildLevel2() {
  const LW = 300;
  initTileGrid(LW);
  S.checkpointCols = [80, 160, 240];
  S.pipeReturnX = 82 * T;

  function lava(x1, x2) {
    for (let x = x1; x <= x2; x++) {
      S.tiles[13][x] = LAVA;
      S.tiles[14][x] = LAVA;
    }
  }

  // === GROUND SECTIONS (with lava-filled gaps) ===
  ground(0, 30);
  lava(31, 35);   ground(36, 60);
  lava(61, 65);   ground(66, 95);
  lava(96, 100);  ground(101, 130);
  lava(131, 135); ground(136, 165);
  lava(166, 170); ground(171, 200);
  lava(201, 205); ground(206, 235);
  lava(236, 240); ground(241, 299);

  // === SECTION 1: NIGHT INTRO (cols 0-30) ===
  carrot(4, 10); carrot(5, 10); carrot(6, 10);
  blk(BRICK, 10, 9); blk(QCARROT, 11, 9); blk(BRICK, 12, 9);
  blk(QCARROT, 13, 9); blk(BRICK, 14, 9);
  fox(8);
  pipe(17, 2);
  blk(BRICK, 22, 9); blk(BRICK, 23, 9); blk(QLEEK, 24, 9); blk(BRICK, 25, 9);
  carrot(22, 6); carrot(23, 6); carrot(24, 6); carrot(25, 6);
  fox(20); koopa(27);

  // Bridge over first lava (cols 29-37)
  blk(STONE, 29, 11); blk(STONE, 30, 11);
  blk(STONE, 31, 11); blk(STONE, 32, 11); blk(STONE, 33, 11);
  blk(STONE, 34, 11); blk(STONE, 35, 11);
  blk(STONE, 36, 11); blk(STONE, 37, 11);
  fox(33);

  // === SECTION 2: PIPES AND BLOCKS (cols 36-60) ===
  pipe(40, 3);
  blk(QCARROT, 44, 9); blk(BRICK, 45, 9); blk(QLEEK, 46, 9);
  blk(BRICK, 47, 9); blk(BRICK, 48, 9);
  pipe(51, 2);
  fox(43); fox(47); koopa(53);
  carrot(44, 6); carrot(45, 6); carrot(46, 6);
  blk(BRICK, 55, 9); blk(BRICK, 56, 9); blk(QCARROT, 57, 9);
  blk(BRICK, 58, 5); blk(BRICK, 59, 5); blk(QKUMA, 60, 5);
  fox(56); fox(59);

  // Bridge over second lava (cols 59-67)
  blk(STONE, 60, 11); blk(STONE, 61, 11); blk(STONE, 62, 11);
  blk(STONE, 63, 11); blk(STONE, 64, 11); blk(STONE, 65, 11);

  // === SECTION 3: FORTRESS (cols 66-95) ===
  for (let x = 68; x <= 72; x++) blk(BRICK, x, 9);
  for (let x = 68; x <= 70; x++) blk(BRICK, x, 5);
  blk(QCARROT, 71, 5);
  fox(69); fox(73);
  pipe(76, 4);
  yellowPipe(80, 3); // Underground bonus!

  blk(BRICK, 84, 9); blk(QCARROT, 85, 9); blk(BRICK, 86, 9);
  blk(BRICK, 87, 9); blk(QCARROT, 88, 9); blk(BRICK, 89, 9);
  blk(BRICK, 84, 5); blk(BRICK, 85, 5); blk(Q1UP, 86, 5);
  blk(BRICK, 87, 5); blk(BRICK, 88, 5); blk(BRICK, 89, 5);
  koopa(85); fox(88); fox(91); koopa(93);
  carrot(84, 2); carrot(85, 2); carrot(86, 2);
  carrot(87, 2); carrot(88, 2); carrot(89, 2);

  // Bridge over third lava
  blk(STONE, 95, 11); blk(STONE, 96, 11); blk(STONE, 97, 11);
  blk(STONE, 98, 11); blk(STONE, 99, 11); blk(STONE, 100, 11);

  // === SECTION 4: CHALLENGE ZONE (cols 101-130) ===
  blk(BRICK, 104, 9); blk(BRICK, 105, 9); blk(QCARROT, 106, 9);
  blk(BRICK, 107, 9);
  fox(103); fox(106); koopa(109);

  pipe(112, 2);
  pipe(116, 3);

  blk(BRICK, 120, 9); blk(BRICK, 121, 9); blk(QLEEK, 122, 9);
  blk(BRICK, 123, 9); blk(BRICK, 124, 9);
  blk(BRICK, 120, 5); blk(QCARROT, 122, 5); blk(BRICK, 124, 5);
  fox(119); koopa(123); fox(126); fox(128);
  carrot(120, 2); carrot(121, 2); carrot(122, 2); carrot(123, 2); carrot(124, 2);

  // Bridge over fourth lava
  blk(STONE, 130, 11); blk(STONE, 131, 11); blk(STONE, 132, 11);
  blk(STONE, 133, 11); blk(STONE, 134, 11); blk(STONE, 135, 11);
  fox(132);

  // === SECTION 5: VERTICAL CHALLENGE (cols 136-165) ===
  // *** Reduced from 5 to 4 so small Bun Bun can always escape ***
  stair(138, 4, 1);
  stair(148, 4, -1);
  fox(140); fox(143); koopa(146);

  // Upper platforms
  blk(BRICK, 142, 6); blk(BRICK, 143, 6); blk(BRICK, 144, 6);
  blk(QCARROT, 143, 3);
  carrot(142, 3); carrot(144, 3);

  blk(BRICK, 152, 9); blk(BRICK, 153, 9); blk(QLEEK, 154, 9);
  blk(BRICK, 155, 9); blk(BRICK, 156, 9);
  pipe(159, 2);
  fox(153); fox(157); koopa(161);
  carrot(152, 6); carrot(153, 6); carrot(154, 6); carrot(155, 6);
  blk(BRICK, 163, 9); blk(BRICK, 164, 9); blk(BRICK, 165, 9);

  // Bridge over fifth lava
  blk(STONE, 165, 11); blk(STONE, 166, 11); blk(STONE, 167, 11);
  blk(STONE, 168, 11); blk(STONE, 169, 11); blk(STONE, 170, 11);

  // === SECTION 6: MIKU ZONE (cols 171-200) ===
  blk(BRICK, 174, 9); blk(BRICK, 175, 9); blk(QLEEK, 176, 9);
  blk(BRICK, 177, 9);

  // Musical staff platforms (horizontal brick lines)
  for (let x = 180; x <= 195; x += 3) blk(BRICK, x, 10);
  for (let x = 181; x <= 194; x += 3) blk(BRICK, x, 7);
  for (let x = 182; x <= 193; x += 3) blk(BRICK, x, 4);

  // Musical note carrots scattered
  carrot(180, 7); carrot(183, 4); carrot(186, 7); carrot(189, 4);
  carrot(192, 7); carrot(195, 4);

  blk(QCARROT, 185, 9); blk(QKUMA, 190, 9);
  fox(178); fox(182); koopa(186); fox(191); fox(195);
  pipe(198, 3);

  // Bridge over sixth lava
  blk(STONE, 200, 11); blk(STONE, 201, 11); blk(STONE, 202, 11);
  blk(STONE, 203, 11); blk(STONE, 204, 11); blk(STONE, 205, 11);

  // === SECTION 7: GAUNTLET (cols 206-235) ===
  pipe(208, 2);
  pipe(212, 4);
  blk(BRICK, 216, 9); blk(BRICK, 217, 9); blk(QCARROT, 218, 9);
  blk(BRICK, 219, 9); blk(BRICK, 220, 9);
  blk(BRICK, 216, 5); blk(BRICK, 217, 5); blk(QYOSHI, 218, 5);
  blk(BRICK, 219, 5); blk(QSTAR, 220, 5);
  fox(210); fox(215); koopa(219); fox(222); koopa(225); fox(228);
  carrot(216, 2); carrot(217, 2); carrot(218, 2); carrot(219, 2); carrot(220, 2);

  pipe(224, 3);
  blk(BRICK, 228, 9); blk(BRICK, 229, 9); blk(QLEEK, 230, 9);
  blk(BRICK, 231, 9);
  fox(229); fox(232); koopa(234);
  carrot(228, 6); carrot(229, 6); carrot(230, 6);

  // Bridge over seventh lava
  blk(STONE, 235, 11); blk(STONE, 236, 11); blk(STONE, 237, 11);
  blk(STONE, 238, 11); blk(STONE, 239, 11); blk(STONE, 240, 11);
  fox(237);

  // === SECTION 8: GRAND STAIRCASE (cols 241-270) ===
  stair(244, 4, 1);
  fox(246); fox(248);

  blk(BRICK, 252, 9); blk(BRICK, 253, 9); blk(QCARROT, 254, 9);
  blk(BRICK, 255, 9); blk(BRICK, 256, 9);
  blk(QCARROT, 254, 5);
  koopa(253); fox(256);
  carrot(252, 6); carrot(253, 6); carrot(254, 6); carrot(255, 6);

  stair(260, 4, -1);
  fox(262); koopa(265);

  blk(BRICK, 268, 9); blk(BRICK, 269, 9); blk(QCARROT, 270, 9);
  fox(268); fox(271);

  // === SECTION 9: FINAL APPROACH (cols 271-285) ===
  pipe(274, 2);
  pipe(278, 3);
  fox(275); koopa(277); fox(280); koopa(282);

  // Grand staircase to flagpole
  stair(284, 8, 1);

  // === FLAGPOLE ===
  S.flagpole = {
    x: 293 * T,
    baseY: 13 * T,
    topY: 3 * T,
    captured: false,
    flagY: 3 * T + 8,
  };

  // === GRAND CASTLE ===
  for (let cx = 295; cx <= 299; cx++) {
    for (let cy = 6; cy <= 12; cy++) {
      S.tiles[cy][cx] = STONE;
    }
  }
  // Tall towers
  for (let cy = 3; cy <= 5; cy++) {
    S.tiles[cy][295] = STONE;
    S.tiles[cy][299] = STONE;
  }
  blk(STONE, 295, 2); blk(STONE, 297, 5); blk(STONE, 299, 2);
  // Door
  S.tiles[12][297] = EMPTY; S.tiles[11][297] = EMPTY;
  S.tiles[10][297] = EMPTY;
}

// =========================
//  Level 2 Underground
//  Lava Cavern — more epic
// =========================

export function buildUnderground2() {
  const UW = 70;
  initTileGrid(UW);

  // Stone ceiling (rows 0-1)
  for (let x = 0; x < UW; x++) {
    S.tiles[0][x] = STONE;
    S.tiles[1][x] = STONE;
  }

  // Stone ground (rows 13-14) with lava gaps
  for (let x = 0; x < UW; x++) {
    if ((x >= 20 && x <= 24) || (x >= 40 && x <= 44) || (x >= 55 && x <= 58)) {
      S.tiles[13][x] = LAVA;
      S.tiles[14][x] = LAVA;
    } else {
      S.tiles[13][x] = STONE;
      S.tiles[14][x] = STONE;
    }
  }

  // Side walls
  for (let y = 0; y < LEVEL_H; y++) {
    S.tiles[y][0] = STONE;
    S.tiles[y][UW - 1] = STONE;
  }

  // Entry yellow pipe (height 2) at col 3
  S.tiles[11][3] = YPTL; S.tiles[11][4] = YPTR;
  S.tiles[12][3] = YPBL; S.tiles[12][4] = YPBR;

  // Exit yellow pipe at col 64
  S.tiles[11][64] = YPTL; S.tiles[11][65] = YPTR;
  S.tiles[12][64] = YPBL; S.tiles[12][65] = YPBR;

  // === Section 1: Treasure room (cols 6-18) ===
  blk(STONE, 8, 10); blk(STONE, 9, 10); blk(STONE, 10, 10);
  blk(STONE, 13, 8); blk(STONE, 14, 8); blk(STONE, 15, 8);
  blk(STONE, 10, 6); blk(STONE, 11, 6); blk(STONE, 12, 6);

  // Carrot waterfall pattern
  for (let x = 7; x <= 17; x++) carrot(x, 11);
  for (let x = 8; x <= 16; x++) carrot(x, 9);
  for (let x = 9; x <= 15; x++) carrot(x, 7);
  for (let x = 10; x <= 14; x++) carrot(x, 5);
  for (let x = 11; x <= 13; x++) carrot(x, 3);

  // Powerup blocks
  blk(QMIKU, 12, 4);
  blk(QCARROT, 9, 10); blk(QCARROT, 14, 8);

  // === Section 2: Lava crossing (cols 18-28) ===
  blk(STONE, 18, 11); blk(STONE, 19, 11);
  blk(STONE, 22, 10); blk(STONE, 23, 10);
  blk(STONE, 25, 9); blk(STONE, 26, 9);

  carrot(20, 10); carrot(21, 9); carrot(24, 8); carrot(27, 9);
  fox(23);

  // === Section 3: Block maze (cols 28-40) ===
  for (let x = 28; x <= 34; x++) S.tiles[9][x] = BRICK;
  for (let x = 30; x <= 38; x++) S.tiles[6][x] = BRICK;

  blk(QYOSHI, 32, 6);
  blk(QKUMA, 34, 6);
  blk(QLEEK, 31, 9);
  blk(QCARROT, 33, 9);

  fox(30); fox(36);
  koopa(33);

  for (let x = 29; x <= 33; x++) carrot(x, 11);
  for (let x = 31; x <= 37; x++) carrot(x, 8);
  for (let x = 31; x <= 37; x++) carrot(x, 4);

  // === Section 4: Lava gauntlet (cols 40-52) ===
  blk(STONE, 38, 11); blk(STONE, 39, 11);
  blk(STONE, 42, 10); blk(STONE, 43, 10);
  blk(STONE, 45, 11); blk(STONE, 46, 11);
  blk(STONE, 48, 9); blk(STONE, 49, 9);
  blk(STONE, 51, 10); blk(STONE, 52, 10);

  fox(43); fox(52);

  carrot(42, 8); carrot(43, 8);
  carrot(48, 7); carrot(49, 7);
  for (let x = 45; x <= 46; x++) carrot(x, 9);

  blk(QMIKU, 49, 7);

  // === Section 5: Run to exit (cols 52-64) ===
  blk(STONE, 54, 10); blk(STONE, 55, 10); blk(STONE, 56, 10);
  blk(STONE, 57, 10); blk(STONE, 58, 10);

  for (let x = 55; x <= 58; x++) blk(STONE, x, 12);

  for (let x = 55; x <= 63; x++) carrot(x, 10);
  for (let x = 56; x <= 62; x++) carrot(x, 8);
  for (let x = 57; x <= 61; x++) carrot(x, 6);

  blk(QLEEK, 60, 9);

  S.flagpole = null;
}

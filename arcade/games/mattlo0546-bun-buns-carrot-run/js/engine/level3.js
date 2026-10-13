/**
 * Level 3: Neon Burrows  (260 cols)
 * Chiikawa roll playground with drillmole enemies, vine climbing, and sky bonus area.
 */
import S from './state.js';
import {
  T, LEVEL_H,
  BRICK, QCARROT, QLEEK, QKUMA, QMIKU, QCHII, STONE, EMPTY,
  Q1UP, VINE, QSTAR,
  YPTL, YPTR, YPBL, YPBR,
} from './constants.js';
import {
  ground, blk, pipe, yellowPipe, stair,
  fox, koopa, drillmole, carrot, initTileGrid,
} from './level-helpers.js';

export function buildLevel3() {
  const LW = 260;
  initTileGrid(LW);
  S.checkpointCols = [70, 140, 210];
  S.pipeReturnX = 110 * T;
  S.vineSpawns = [];
  S.vineGrowths = [];

  // ============================================================
  //  SECTION 1: Intro & Chiikawa warmup (cols 0-50)
  // ============================================================
  ground(0, 50);

  // Intro carrots + first blocks
  carrot(5, 8); carrot(6, 8); carrot(7, 8);
  blk(BRICK, 14, 9); blk(QCARROT, 15, 9); blk(BRICK, 16, 9);
  blk(QLEEK, 15, 5);
  fox(12); drillmole(20);

  // Short rolling runway
  for (let x = 24; x <= 38; x++) blk(STONE, x, 12);
  drillmole(28, 12); fox(33, 12);
  carrot(26, 9); carrot(29, 9); carrot(32, 9); carrot(35, 9);

  // Platform hop section
  blk(BRICK, 42, 9); blk(BRICK, 43, 9); blk(QCARROT, 44, 9); blk(BRICK, 45, 9);
  blk(BRICK, 42, 5); blk(Q1UP, 44, 5); blk(BRICK, 46, 5);
  fox(40); koopa(48);

  // ============================================================
  //  SECTION 2: Gap crossing & vine tree (cols 51-100)
  // ============================================================
  // Gap
  ground(54, 100);
  blk(STONE, 51, 11); blk(STONE, 52, 11); blk(STONE, 53, 11); blk(STONE, 54, 11);

  // Tree section — a question block that spawns a vine!
  blk(BRICK, 60, 9); blk(QCARROT, 61, 9); blk(BRICK, 62, 9);
  blk(QCARROT, 63, 9); blk(BRICK, 64, 9);

  // THE TREE BLOCK — when hit, vine grows upward to sky platforms
  blk(QLEEK, 68, 9);  // Leek block is on the left
  blk(STONE, 72, 9);  // The vine seed block
  S.vineSpawns.push({ col: 72, row: 9, targetRow: 1, triggered: false });

  // Sky bonus area (accessible via vine from col 72)
  // Floating platforms at rows 2-5 with lots of carrots
  for (let x = 68; x <= 82; x++) blk(STONE, x, 4);
  for (let x = 70; x <= 80; x++) blk(BRICK, x, 2);
  carrot(70, 1); carrot(72, 1); carrot(74, 1); carrot(76, 1); carrot(78, 1); carrot(80, 1);
  carrot(69, 1); carrot(71, 1); carrot(73, 1); carrot(75, 1); carrot(77, 1); carrot(79, 1);
  blk(QSTAR, 75, 2); // SECRET star power in the sky!

  // Enemies below
  drillmole(58); fox(65); drillmole(70);
  pipe(76, 3);

  // Fortress zone
  blk(BRICK, 82, 9); blk(BRICK, 83, 9); blk(QLEEK, 84, 9); blk(BRICK, 85, 9);
  blk(BRICK, 88, 5); blk(QCARROT, 89, 5); blk(BRICK, 90, 5);
  koopa(80); drillmole(86); fox(92);

  // Underground detour pipe
  yellowPipe(95, 4);
  S.pipeReturnX = 110 * T;

  // ============================================================
  //  SECTION 3: Vertical challenge + second vine (cols 101-160)
  // ============================================================
  // Gap
  ground(104, 160);

  // Elevated platforms with enemies
  stair(106, 4, 1);
  carrot(108, 6); carrot(109, 6); carrot(110, 6);
  fox(107); koopa(112);

  // Rolling runway with gaps
  for (let x = 118; x <= 138; x++) {
    if (x % 8 !== 0) blk(STONE, x, 12);
  }
  drillmole(120, 12); fox(126, 12); drillmole(134, 12);
  for (let x = 120; x <= 136; x += 3) carrot(x, 9);

  // Second vine tree — connects to bonus clouds
  blk(STONE, 142, 9);
  S.vineSpawns.push({ col: 142, row: 9, targetRow: 2, triggered: false });

  // Sky cloud platforms (accessible via vine at col 142)
  blk(STONE, 138, 5); blk(STONE, 139, 5); blk(STONE, 140, 5);
  blk(STONE, 141, 5); blk(STONE, 142, 5); blk(STONE, 143, 5);
  blk(STONE, 144, 5); blk(STONE, 145, 5); blk(STONE, 146, 5);
  carrot(139, 2); carrot(141, 2); carrot(143, 2); carrot(145, 2);
  blk(QKUMA, 142, 2); // Kumamon power in the sky

  // High reward bridge
  for (let x = 148; x <= 158; x += 2) blk(BRICK, x, 6);
  blk(QMIKU, 152, 6);
  carrot(149, 3); carrot(151, 3); carrot(153, 3); carrot(155, 3);

  // ============================================================
  //  SECTION 4: Gauntlet & finale (cols 161-259)
  // ============================================================
  // Gap
  ground(164, 259);

  blk(STONE, 161, 11); blk(STONE, 162, 11); blk(STONE, 163, 11);

  // Pipe pair
  pipe(168, 2);
  pipe(174, 4);

  // Block corridor
  blk(BRICK, 180, 9); blk(BRICK, 181, 9); blk(QLEEK, 182, 9); blk(BRICK, 183, 9);
  blk(BRICK, 186, 5); blk(Q1UP, 187, 5); blk(BRICK, 188, 5);
  fox(170); drillmole(176); koopa(184); fox(190);

  // Mixed challenge: stair → runway → stair
  stair(196, 4, 1);
  for (let x = 200; x <= 210; x++) blk(STONE, x, 9);
  drillmole(202, 9); fox(206, 9); drillmole(209, 9);
  carrot(201, 6); carrot(203, 6); carrot(205, 6); carrot(207, 6); carrot(209, 6);
  stair(212, 4, -1);

  // Final stretch
  blk(BRICK, 218, 9); blk(QLEEK, 219, 9); blk(BRICK, 220, 9);
  fox(216); drillmole(222);

  // Staircase to flagpole
  stair(228, 7, 1);

  // Flagpole
  S.flagpole = {
    x: 240 * T,
    baseY: 13 * T,
    topY: 3 * T,
    captured: false,
    flagY: 3 * T + 8,
  };

  // End castle
  for (let cx = 244; cx <= 251; cx++) {
    for (let cy = 8; cy <= 12; cy++) S.tiles[cy][cx] = STONE;
  }
  blk(STONE, 244, 7); blk(STONE, 246, 7); blk(STONE, 248, 7); blk(STONE, 250, 7);
  S.tiles[12][247] = EMPTY; S.tiles[11][247] = EMPTY;
  S.tiles[12][248] = EMPTY; S.tiles[11][248] = EMPTY;
  S.tiles[10][247] = EMPTY; S.tiles[10][248] = EMPTY;
}

// =========================
//  Level 3 Underground
//  Neon Cavern — Chiikawa exclusive
// =========================

export function buildUnderground3() {
  const UW = 60;
  initTileGrid(UW);

  // Brick ceiling (rows 0-1)
  for (let x = 0; x < UW; x++) {
    S.tiles[0][x] = BRICK;
    S.tiles[1][x] = BRICK;
  }

  // Stone ground (rows 13-14)
  for (let x = 0; x < UW; x++) {
    S.tiles[13][x] = STONE;
    S.tiles[14][x] = STONE;
  }

  // Side walls
  for (let y = 0; y < LEVEL_H; y++) {
    S.tiles[y][0] = STONE;
    S.tiles[y][UW - 1] = STONE;
  }

  // Entry yellow pipe (height 2) at col 3
  S.tiles[11][3] = YPTL; S.tiles[11][4] = YPTR;
  S.tiles[12][3] = YPBL; S.tiles[12][4] = YPBR;

  // Exit yellow pipe at col 54
  S.tiles[11][54] = YPTL; S.tiles[11][55] = YPTR;
  S.tiles[12][54] = YPBL; S.tiles[12][55] = YPBR;

  // === Section 1: Rolling runway (cols 6-20) ===
  for (let x = 8; x <= 20; x++) blk(STONE, x, 12);
  drillmole(12, 12); fox(17, 12);
  for (let x = 9; x <= 19; x++) carrot(x, 9);
  for (let x = 10; x <= 18; x++) carrot(x, 7);

  // First Chiikawa block — the exclusive reward!
  blk(BRICK, 12, 8); blk(QCHII, 13, 8); blk(BRICK, 14, 8);

  // === Section 2: Platform challenge (cols 22-38) ===
  blk(STONE, 22, 10); blk(STONE, 23, 10);
  blk(STONE, 26, 8); blk(STONE, 27, 8);
  blk(STONE, 30, 10); blk(STONE, 31, 10);
  blk(STONE, 34, 8); blk(STONE, 35, 8);

  carrot(24, 8); carrot(25, 7);
  carrot(28, 6); carrot(29, 5);
  carrot(32, 8); carrot(33, 7);
  carrot(36, 6); carrot(37, 5);

  blk(BRICK, 28, 6); blk(QCARROT, 29, 6); blk(BRICK, 30, 6);
  fox(25); drillmole(33);

  // === Section 3: Treasure room (cols 38-52) ===
  blk(STONE, 38, 10); blk(STONE, 39, 10); blk(STONE, 40, 10);
  blk(STONE, 41, 10); blk(STONE, 42, 10);

  // Block platform with second Chiikawa
  blk(BRICK, 42, 7); blk(BRICK, 43, 7); blk(QCHII, 44, 7);
  blk(BRICK, 45, 7); blk(BRICK, 46, 7);
  blk(QLEEK, 44, 4);

  // Carrot arches
  for (let x = 42; x <= 52; x++) carrot(x, 11);
  for (let x = 43; x <= 51; x++) carrot(x, 9);
  for (let x = 44; x <= 50; x++) carrot(x, 5);

  drillmole(46); fox(50);

  S.flagpole = null;
}

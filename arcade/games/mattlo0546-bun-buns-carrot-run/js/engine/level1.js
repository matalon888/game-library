/**
 * Level 1 — Green Hills & Underground Bonus.
 */
import S from './state.js';
import {
  T, LEVEL_W, LEVEL_H,
  BRICK, QCARROT, QLEEK, QKUMA, STONE, EMPTY,
  YPTL, YPTR, YPBL, YPBR,
  Q1UP,
} from './constants.js';
import {
  ground, blk, pipe, yellowPipe, stair,
  fox, koopa, carrot, initTileGrid,
} from './level-helpers.js';

// =========================
//    Build Level 1
// =========================

export function buildLevel() {
  initTileGrid(LEVEL_W);
  S.checkpointCols = [76, 140, 168];
  S.pipeReturnX = 90 * T;

  // === GROUND SECTIONS ===
  ground(0, 68);
  ground(71, 86);
  ground(90, 152);
  ground(156, 211);

  // === SECTION 1: INTRO (cols 0-15) ===
  carrot(5, 8); carrot(6, 8); carrot(7, 8);

  // === SECTION 2: FIRST BLOCKS (cols 16-21) ===
  blk(BRICK, 16, 9);
  blk(QCARROT, 17, 9);
  blk(BRICK, 18, 9);
  blk(QCARROT, 19, 9);
  blk(BRICK, 20, 9);
  blk(QLEEK, 18, 5);
  fox(14);

  // === SECTION 3: FIRST PIPE ===
  pipe(22, 2);
  fox(26);

  // === SECTION 4: MORE BLOCKS + PIPE ===
  pipe(28, 3);
  blk(QCARROT, 32, 9); blk(BRICK, 33, 9); blk(QCARROT, 34, 9);
  blk(BRICK, 35, 9); blk(QCARROT, 36, 9);
  fox(33); fox(37);
  yellowPipe(40, 4);
  carrot(32, 6); carrot(33, 6); carrot(34, 6); carrot(35, 6); carrot(36, 6);

  // === SECTION 5: ELEVATED BLOCKS ===
  blk(BRICK, 42, 9); blk(BRICK, 43, 9); blk(BRICK, 44, 9);
  blk(QCARROT, 45, 9);
  blk(BRICK, 46, 9); blk(BRICK, 47, 9); blk(BRICK, 48, 9);
  blk(BRICK, 46, 5); blk(Q1UP, 47, 5);
  blk(QLEEK, 48, 5); blk(BRICK, 49, 5);
  carrot(43, 5); carrot(44, 5); carrot(45, 5);
  fox(44); koopa(50);

  // === SECTION 6: PIPES + BLOCKS ===
  pipe(52, 2);
  pipe(56, 3);
  blk(BRICK, 60, 9); blk(QCARROT, 61, 9);
  blk(QLEEK, 62, 9); blk(BRICK, 63, 9);
  fox(58); koopa(62); fox(65);
  carrot(60, 6); carrot(61, 6); carrot(62, 6); carrot(63, 6);

  // === SECTION 7: POST-GAP ===
  blk(QCARROT, 73, 9);
  blk(BRICK, 74, 9); blk(BRICK, 75, 9);
  blk(BRICK, 76, 9); blk(QCARROT, 77, 9);
  fox(75); fox(79);
  pipe(82, 2);
  fox(84);
  carrot(73, 6); carrot(74, 6); carrot(75, 6);

  // === SECTION 8: CHALLENGE ===
  blk(BRICK, 91, 9); blk(BRICK, 92, 9);
  blk(QCARROT, 93, 9); blk(BRICK, 94, 9);
  blk(QLEEK, 96, 5);
  carrot(91, 6); carrot(92, 6); carrot(93, 6); carrot(94, 6);
  stair(100, 4, 1);
  stair(108, 4, -1);
  fox(97); koopa(105); fox(112);

  // === SECTION 9: PIPES + BLOCKS ===
  pipe(114, 2);
  blk(BRICK, 118, 9); blk(BRICK, 119, 9);
  blk(QLEEK, 120, 9); blk(BRICK, 121, 9); blk(BRICK, 122, 9);
  blk(QCARROT, 120, 5);
  fox(119); koopa(124); fox(128);
  pipe(130, 3);
  pipe(134, 4);
  blk(BRICK, 138, 9); blk(BRICK, 139, 9);
  blk(BRICK, 140, 9); blk(QCARROT, 141, 9); blk(BRICK, 142, 9);
  fox(138); fox(142); koopa(146);
  carrot(118, 6); carrot(119, 6); carrot(120, 6);
  carrot(138, 6); carrot(139, 6);

  // === SECTION 10: PRE-END ===
  blk(BRICK, 148, 9); blk(QCARROT, 149, 9); blk(BRICK, 150, 9);
  fox(148); fox(150);

  // === SECTION 11: FINAL STRETCH ===
  pipe(158, 2);
  blk(BRICK, 162, 9); blk(BRICK, 163, 9);
  blk(QLEEK, 164, 9); blk(BRICK, 165, 9); blk(BRICK, 166, 9);
  blk(QLEEK, 167, 5);
  fox(160); koopa(164);
  carrot(162, 6); carrot(163, 6); carrot(164, 6);

  // === STAIRCASE ===
  stair(172, 8, 1);

  // === FLAGPOLE ===
  S.flagpole = {
    x: 181 * T,
    baseY: 13 * T,
    topY: 4 * T,
    captured: false,
    flagY: 4 * T + 8,
  };

  // === CASTLE ===
  for (let cx = 188; cx <= 195; cx++) {
    for (let cy = 8; cy <= 12; cy++) {
      S.tiles[cy][cx] = STONE;
    }
  }
  // Crenellations
  blk(STONE, 188, 7); blk(STONE, 190, 7); blk(STONE, 192, 7); blk(STONE, 194, 7);
  // Door opening
  S.tiles[12][191] = EMPTY; S.tiles[11][191] = EMPTY;
  S.tiles[12][192] = EMPTY; S.tiles[11][192] = EMPTY;
  S.tiles[10][191] = EMPTY; S.tiles[10][192] = EMPTY;
}

// =========================
//  Underground Bonus Level
// =========================

export function buildUnderground() {
  initTileGrid(LEVEL_W);

  // Brick ceiling (rows 0-1)
  for (let x = 0; x < 50; x++) {
    S.tiles[0][x] = BRICK;
    S.tiles[1][x] = BRICK;
  }

  // Stone ground (rows 13-14)
  for (let x = 0; x < 50; x++) {
    S.tiles[13][x] = STONE;
    S.tiles[14][x] = STONE;
  }

  // Side walls
  for (let y = 0; y < LEVEL_H; y++) {
    S.tiles[y][0] = STONE;
    S.tiles[y][49] = STONE;
  }

  // Entry yellow pipe (height 2) at col 3
  S.tiles[11][3] = YPTL; S.tiles[11][4] = YPTR;
  S.tiles[12][3] = YPBL; S.tiles[12][4] = YPBR;

  // Exit yellow pipe (height 2) at col 44
  S.tiles[11][44] = YPTL; S.tiles[11][45] = YPTR;
  S.tiles[12][44] = YPBL; S.tiles[12][45] = YPBR;

  // Carrot arch 1 (cols 8-16)
  for (let x = 8; x <= 16; x++) carrot(x, 10);
  for (let x = 9; x <= 15; x++) carrot(x, 8);
  for (let x = 10; x <= 14; x++) carrot(x, 6);

  // Carrot arch 2 (cols 20-32)
  for (let x = 20; x <= 32; x++) carrot(x, 10);
  for (let x = 21; x <= 31; x++) carrot(x, 8);
  for (let x = 22; x <= 30; x++) carrot(x, 6);

  // Carrots near exit
  for (let x = 36; x <= 42; x++) carrot(x, 10);
  for (let x = 37; x <= 41; x++) carrot(x, 8);

  // Block rows (lowered to reachable height)
  blk(BRICK, 10, 7); blk(BRICK, 11, 7); blk(QCARROT, 12, 7);
  blk(BRICK, 13, 7); blk(BRICK, 14, 7);
  blk(BRICK, 24, 7); blk(QCARROT, 25, 7);
  blk(BRICK, 26, 7); blk(QKUMA, 27, 7); blk(BRICK, 28, 7);

  // Stepping platform mid-room to reach upper carrots
  blk(BRICK, 17, 10); blk(BRICK, 18, 10); blk(BRICK, 19, 10);

  // Floating platform near exit
  blk(BRICK, 35, 9); blk(BRICK, 36, 9); blk(BRICK, 37, 9);
  blk(QLEEK, 38, 9); blk(BRICK, 39, 9); blk(BRICK, 40, 9);

  // Stepping platform to reach exit area
  blk(STONE, 32, 10); blk(STONE, 33, 10); blk(STONE, 34, 10);

  S.flagpole = null;
}

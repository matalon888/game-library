/**
 * Hub World — lobby with pipe entrances to each level.
 */
import S from './state.js';
import { STONE } from './constants.js';
import { ground, pipe, blk, initTileGrid } from './level-helpers.js';

const HUB_COLS = 80;

export function buildHub() {
  initTileGrid(HUB_COLS);
  S.flagpole = null;
  S.checkpointCols = [];
  S.pipeReturnX = 0;
  S.underground = false;

  // Ground
  ground(0, HUB_COLS - 1);

  // Decorative pipes for entrances
  pipe(10, 2);
  pipe(24, 3);
  pipe(52, 4);

  // Small stone platform near the door entrance
  for (let x = 36; x <= 40; x++) {
    S.tiles[11][x] = STONE;
    S.tiles[12][x] = STONE;
  }
}

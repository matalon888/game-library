/**
 * Level registry — wires up per-level build functions and hub config.
 * Individual level files live in level-hub.js, level1.js, level2.js, level3.js.
 */
import { T } from './constants.js';

import { buildHub }                           from './level-hub.js';
import { buildLevel, buildUnderground }       from './level1.js';
import { buildLevel2, buildUnderground2 }     from './level2.js';
import { buildLevel3, buildUnderground3 }                        from './level3.js';

// Re-export build functions so existing imports in main.js keep working
export { buildLevel, buildUnderground, buildLevel2, buildUnderground2, buildLevel3, buildUnderground3 };

// =========================
//    Level Config Registry
// =========================

export const LEVEL_CONFIGS = {
  hub: {
    id: 'hub',
    type: 'hub',
    levelNumber: 1,
    spawn: { x: 3 * T, y: 12 * T, facing: 1 },
    entrances: [
      {
        id: 'level1',
        kind: 'pipe',
        number: 1,
        input: 'down',
        pipeTopRow: 11,
        pipeLipX: 10 * T,
        pipeLipW: 2 * T,
        x: 9 * T,
        y: 10 * T,
        w: 4 * T,
        h: 4 * T,
        returnSpawn: { x: 10 * T, y: 12 * T, facing: 1 },
      },
      {
        id: 'level2',
        kind: 'pipe',
        number: 2,
        input: 'down',
        pipeTopRow: 10,
        pipeLipX: 24 * T,
        pipeLipW: 2 * T,
        x: 23 * T,
        y: 9 * T,
        w: 4 * T,
        h: 5 * T,
        returnSpawn: { x: 24 * T, y: 12 * T, facing: 1 },
      },
      {
        id: 'level3',
        kind: 'pipe',
        number: 3,
        input: 'down',
        pipeTopRow: 9,
        pipeLipX: 52 * T,
        pipeLipW: 2 * T,
        x: 51 * T,
        y: 8 * T,
        w: 4 * T,
        h: 6 * T,
        returnSpawn: { x: 52 * T, y: 12 * T, facing: 1 },
      },
    ],
  },
  level1: {
    id: 'level1',
    levelNumber: 1,
    build: buildLevel,
    spawn: { x: 3 * T, y: 12 * T, facing: 1 },
    hubReturn: { x: 10 * T, y: 12 * T, facing: 1 },
  },
  level2: {
    id: 'level2',
    levelNumber: 2,
    build: buildLevel2,
    spawn: { x: 3 * T, y: 12 * T, facing: 1 },
    hubReturn: { x: 24 * T, y: 12 * T, facing: 1 },
  },
  level3: {
    id: 'level3',
    levelNumber: 3,
    build: buildLevel3,
    spawn: { x: 3 * T, y: 12 * T, facing: 1 },
    hubReturn: { x: 52 * T, y: 12 * T, facing: 1 },
  },
};

export function getHubEntrances() {
  return LEVEL_CONFIGS.hub.entrances;
}

export function loadLevelById(levelId) {
  if (levelId === 'hub') {
    buildHub();
    return LEVEL_CONFIGS.hub;
  }
  const cfg = LEVEL_CONFIGS[levelId];
  if (cfg && cfg.build) cfg.build();
  return cfg;
}
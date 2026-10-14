// Maintains the fish population. Spawning happens only during FISHING and
// HOOKED states; in any other state existing fish are still updated and
// allowed to swim off-screen naturally.

import { FISH, SCENE } from '../config.js';
import { FISH_TYPES } from './fishTypes.js';
import { Fish } from './fish.js';
import * as Upgrades from '../upgrades.js';

const SPAWN_EDGE_MARGIN = 30;
const SPAWN_OFFSCREEN_OFFSET = 50;

const fishList = [];
let spawnTimer = 0;

function randomRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function pickTypeByWeight() {
  const weights = FISH.SPAWN_WEIGHTS;
  let total = 0;
  for (const key in weights) total += weights[key];
  let r = Math.random() * total;
  for (const key in weights) {
    r -= weights[key];
    if (r <= 0) return FISH_TYPES[key];
  }
  return FISH_TYPES.small;
}

function createFish(width, height) {
  const type = pickTypeByWeight();
  const direction = Math.random() < 0.5 ? 1 : -1;
  const waterY = height * SCENE.WATER_LINE_RATIO;
  const minY = waterY + SPAWN_EDGE_MARGIN;
  const maxY = height - SPAWN_EDGE_MARGIN;
  const y = randomRange(minY, maxY);
  const x = direction > 0 ? -SPAWN_OFFSCREEN_OFFSET : width + SPAWN_OFFSCREEN_OFFSET;
  return new Fish(type, x, y, direction);
}

export const fishSpawner = {
  update(frame) {
    const { dtMs, width, height } = frame;

    // Update existing fish; remove ones that have swum off-screen.
    for (let i = fishList.length - 1; i >= 0; i--) {
      const fish = fishList[i];
      fish.update(frame);
      if (fish.isOffscreen(width)) {
        fishList.splice(i, 1);
      }
    }

    // Always keep the population topped up — fish swim around in every
    // screen (menu, calibration, in-game) for ambient life.
    spawnTimer -= dtMs;
    if (spawnTimer <= 0 && fishList.length < FISH.POPULATION_TARGET) {
      fishList.push(createFish(width, height));
      // Spawn upgrade shrinks the interval (e.g. level 2 → 24% faster).
      const reduction = Math.min(0.75, Upgrades.getEffect('spawn'));
      spawnTimer = FISH.SPAWN_INTERVAL_MS * (1 - reduction);
    }
  },

  draw({ ctx }) {
    for (const fish of fishList) fish.draw(ctx);
  },

  getFish() {
    return fishList;
  },

  removeFish(fish) {
    const i = fishList.indexOf(fish);
    if (i >= 0) fishList.splice(i, 1);
  },

  clear() {
    fishList.length = 0;
  },

  // Seed the scene with a few fish already inside the visible area so the
  // app doesn't start with an empty water (called once at boot).
  seedAmbient(width, height) {
    if (fishList.length > 0) return;
    const target = Math.max(3, Math.floor(FISH.POPULATION_TARGET * 0.6));
    for (let i = 0; i < target; i++) {
      const type = pickTypeByWeight();
      const direction = Math.random() < 0.5 ? 1 : -1;
      const waterY = height * SCENE.WATER_LINE_RATIO;
      const minY = waterY + SPAWN_EDGE_MARGIN;
      const maxY = height - SPAWN_EDGE_MARGIN;
      const y = randomRange(minY, maxY);
      const x = randomRange(width * 0.1, width * 0.9);
      fishList.push(new Fish(type, x, y, direction));
    }
  },
};

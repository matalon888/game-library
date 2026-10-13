// World Manifest
//
// Central list of all available world IDs in the game.
//
// To add a new world:
//   1. Create src/worlds/<world-id>/config.js exporting a WorldConfig
//   2. Add the config import to src/worlds/loader.js
//   3. Add "<world-id>" to the array below
//
// The loader reads this manifest and registers each world
// with the WorldRegistry. No engine code needs to change.

export const WORLD_IDS = [
  'floresta-encantada',
  'dinossauros',
  'galaxia-estelar',
  'reino-oceanos',
  'castelo-dragoes',
];

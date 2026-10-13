/**
 * Shared mutable game state.
 * All modules import this single object and read/write to it.
 */
const S = {
  // Canvas references (set during init)
  canvas: null,
  ctx: null,

  // Game state machine
  state: 'title',   // 'title' | 'hub' | 'playing' | 'dying' | 'gameover' | 'win' | 'pipe'

  // Scoring & status
  score: 0,
  coinCount: 0,
  lives: 3,
  time: 400,

  // Timers
  tick: 0,
  deathTimer: 0,
  winTimer: 0,
  invTimer: 0,

  // Camera
  cam: { x: 0 },

  // Checkpoint state
  checkpointX: 3 * 32,
  reachedCheckpoints: {},

  // Level data
  tiles: [],
  enemies: [],
  items: [],
  flagpole: null,

  // Player (set by resetPlayer)
  player: null,

  // Dynamic entities
  leekProjectiles: [],
  particles: [],
  popups: [],
  blockAnims: [],

  // Star power
  starTimer: 0,

  // Vine system
  vineGrowths: [],
  vineSpawns: [],

  // Underground pipe system
  underground: false,
  mainWorldSave: null,
  pipeAnim: null,
  pipeReturnX: 90 * 32,

  // Level progression
  level: 1,
  checkpointCols: [],

  // Hub world routing
  currentLevelId: null,
  hubEntrances: [],
  hubReturnSpawn: null,
  hubSpawnDefault: { x: 3 * 32, y: 12 * 32, facing: 1 },
  // Lock-pipe denial pulse (set when player tries to enter a locked entrance)
  lockDenyTimer: 0,
  lockDenyEntranceId: null,

  // Win screen menu choice
  winChoice: 'hub',

  // Title shown on the title screen (the Character Maker can change it).
  customTitle: null,

  // Custom overrides for Game Maker mode.
  // Each entry can be an array of HTMLImageElement (Schema v1)
  // or an object { frames, anchor, hitbox, dimensions } (Schema v2).
  customSprites: /** @type {{ player: any, playerPowered?: any, enemy: any, powerup: any }} */ ({
    player: null,
    playerPowered: null,
    enemy: null,
    powerup: null,
  }),
};

export default S;

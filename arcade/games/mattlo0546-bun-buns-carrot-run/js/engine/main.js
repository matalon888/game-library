/**
 * Main entry point — initializes canvas, manages game loop and state transitions.
 */
import S from './state.js';
import { W, H, T, GRAV } from './constants.js';
import { initAudio, sfx, startMusic, stopMusic } from './audio.js';
import { isDown, wasPressed, clearJustPressed } from './input.js';
import { rectOverlap } from './collision.js';
import { buildLevel, buildLevel2, buildUnderground, buildUnderground2, buildUnderground3, loadLevelById, getHubEntrances } from './level.js';
import { resetPlayer, updatePlayer, playerDie, getPlayerPowerState, applyPlayerPowerState } from './player.js';
import { isLevelLocked, markLevelCompleted } from './progress.js';
import { updateEnemies, updateProjectiles, updateItems, updateParticles, updateCamera, updateVineGrowths } from './entities.js';
import { render } from './renderer.js';
import { preloadSprites } from './sprites.js';

// =========================
//     Game Reset
// =========================

function resetGame(keepProgress) {
  if (!keepProgress) {
    S.score = 0;
    S.coinCount = 0;
    S.lives = 3;
  }
  S.time = S.level >= 2 ? 500 : 400;
  S.tick = 0;
  S.cam.x = 0;
  S.checkpointX = 3 * 32;
  S.reachedCheckpoints = {};
  S.leekProjectiles = [];
  S.particles = [];
  S.popups = [];
  S.blockAnims = [];
  S.starTimer = 0;
  S.vineGrowths = [];
  S.vineSpawns = [];
  S.underground = false;
  S.mainWorldSave = null;
  S.pipeAnim = null;
  if (S.level >= 2) buildLevel2();
  else buildLevel();
  resetPlayer();
}

function resetSceneCommon(keepProgress) {
  if (!keepProgress) {
    S.score = 0;
    S.coinCount = 0;
    S.lives = 3;
  }
  S.tick = 0;
  S.cam.x = 0;
  S.leekProjectiles = [];
  S.particles = [];
  S.popups = [];
  S.blockAnims = [];
  S.starTimer = 0;
  S.vineGrowths = [];
  S.vineSpawns = [];
  S.underground = false;
  S.mainWorldSave = null;
  S.pipeAnim = null;
}

function loadHub(spawnOverride) {
  resetSceneCommon(true);
  const cfg = loadLevelById('hub');
  S.level = cfg.levelNumber || 1;
  S.state = 'hub';
  S.currentLevelId = null;
  S.time = 0;
  S.checkpointX = cfg.spawn.x;
  S.reachedCheckpoints = {};
  S.hubEntrances = getHubEntrances();
  const spawn = spawnOverride || cfg.spawn || S.hubSpawnDefault;
  resetPlayer(spawn);
  S.winChoice = 'hub';
}

function loadLevel(levelId, keepProgress, carryPowerState) {
  resetSceneCommon(keepProgress);
  const cfg = loadLevelById(levelId);
  if (!cfg) return;
  S.level = cfg.levelNumber || 1;
  S.currentLevelId = levelId;
  S.time = S.level >= 2 ? 500 : 400;
  S.checkpointX = cfg.spawn.x;
  S.reachedCheckpoints = {};
  resetPlayer(cfg.spawn);
  if (carryPowerState) applyPlayerPowerState(carryPowerState);
  S.state = 'playing';
  S.winChoice = 'hub';
}

function checkHubEntrances() {
  const p = S.player;
  for (let i = 0; i < S.hubEntrances.length; i++) {
    const e = S.hubEntrances[i];
    const hit = rectOverlap(p, { x: e.x, y: e.y, w: e.w, h: e.h });
    if (!hit) continue;
    const triggered =
      (e.input === 'down' && (wasPressed('ArrowDown') || isDown('ArrowDown'))) ||
      (e.input === 'up' && wasPressed('ArrowUp'));
    if (!triggered) continue;
    if (isLevelLocked(e.id)) {
      // Denied — show a denial pulse + sound, do not enter the pipe.
      if (!S.lockDenyTimer || S.lockDenyTimer <= 0) {
        sfx.bump && sfx.bump();
        S.lockDenyTimer = 30;
        S.lockDenyEntranceId = e.id;
      }
      return null;
    }
    return e;
  }
  return null;
}

// =========================
//     Update Dispatch
// =========================

function update() {
  if (S.state === 'hub') {
    S.tick++;
    if (S.lockDenyTimer > 0) S.lockDenyTimer--;
    const entrance = checkHubEntrances();
    if (entrance) {
      S.hubReturnSpawn = entrance.returnSpawn || S.hubSpawnDefault;
      S.hubPipeTarget = entrance.id;
      sfx.pipe();
      S.player.vx = 0;
      S.player.vy = 0;
      S.pipeAnim = {
        phase: 'sinking',
        timer: 0,
        pipeTopRow: entrance.pipeTopRow,
        pipeLipX: entrance.pipeLipX,
        pipeLipW: entrance.pipeLipW,
      };
      S.state = 'hubPipe';
      return;
    }
    updatePlayer();
    updateParticles();
    updateCamera();
  }

  else if (S.state === 'playing') {
    S.tick++;
    if (S.tick % 60 === 0 && S.time > 0) S.time--;
    if (S.time <= 0 && !S.player.dead) playerDie();
    updatePlayer();
    updateEnemies();
    updateProjectiles();
    updateItems();
    updateVineGrowths();
    updateParticles();
    updateCamera();
  }

  else if (S.state === 'dying') {
    S.tick++;
    S.player.vy += GRAV;
    S.player.y += S.player.vy;
    S.deathTimer--;
    updateParticles();
    if (S.deathTimer <= 0) {
      if (S.lives <= 0) {
        stopMusic();
        S.state = 'gameover';
        sfx.gameover();
      } else {
        resetPlayer();
        if (S.underground) {
          S.cam.x = 0;
        } else {
          S.cam.x = Math.max(0, S.checkpointX - W / 3);
        }
        // Clear enemies near spawn so player doesn't instantly die again
        const spawnX = S.player.x;
        const killZone = W * 0.4;
        const pushZone = W * 0.8;
        for (let i = 0; i < S.enemies.length; i++) {
          const e = S.enemies[i];
          if (!e.alive) continue;
          const dist = Math.abs(e.x - spawnX);
          if (dist < killZone) {
            // Remove enemies very close to spawn
            e.alive = false;
          } else if (dist < pushZone) {
            e.x = e.x < spawnX ? spawnX - pushZone - 64 : spawnX + pushZone + 64;
          }
        }
        S.time = S.level >= 2 ? 500 : 400;
        S.leekProjectiles = [];
        S.state = 'playing';
      }
    }
  }

  else if (S.state === 'win') {
    S.tick++;
    S.winTimer++;
    if (S.flagpole) {
      S.flagpole.flagY = Math.min(S.flagpole.flagY + 2, S.flagpole.baseY - 24);
    }
    updateParticles();

    // Fireworks
    if (S.winTimer % 25 === 0 && S.winTimer < 200) {
      const fx = S.cam.x + 100 + Math.random() * (W - 200);
      const fy = 40 + Math.random() * H * 0.4;
      const colors = ['#ff0', '#f44', '#4f4', '#4ff', '#f4f', '#fff', '#fa0'];
      for (let fi = 0; fi < 10; fi++) {
        const angle = (fi / 10) * Math.PI * 2;
        S.particles.push({
          x: fx, y: fy, w: 5, h: 5,
          vx: Math.cos(angle) * (2 + Math.random() * 2),
          vy: Math.sin(angle) * (2 + Math.random() * 2),
          type: 'firework', timer: 35 + Math.random() * 15,
          color: colors[Math.floor(Math.random() * colors.length)],
          gy: 0.08,
        });
      }
    }
  }

  else if (S.state === 'hubPipe') {
    S.tick++;
    const anim = S.pipeAnim;
    anim.timer++;

    if (anim.phase === 'sinking') {
      S.player.y += 1.5;
      if (anim.timer >= 30) {
        anim.phase = 'black';
        anim.timer = 0;
      }
    } else if (anim.phase === 'black') {
      if (anim.timer >= 25) {
        anim.phase = 'fading';
        anim.timer = 0;
        // Actually load the level during the fade
        loadLevel(S.hubPipeTarget, true);
        startMusic(S.level);
        S.hubPipeTarget = null;
      }
    } else if (anim.phase === 'fading') {
      if (anim.timer >= 30) {
        S.pipeAnim = null;
        // state is already 'playing' from loadLevel
      }
    }
  }

  else if (S.state === 'pipe') {
    S.tick++;
    const anim = S.pipeAnim;
    anim.timer++;

    if (anim.phase === 'sinking') {
      S.player.y += 1.5;
      if (anim.timer >= 30) {
        anim.phase = 'black';
        anim.timer = 0;
        // Swap between main world and underground
        if (!S.underground) {
          S.mainWorldSave = {
            tiles: S.tiles,
            enemies: S.enemies,
            items: S.items,
            flagpole: S.flagpole,
            camX: S.cam.x,
          };
          if (S.level >= 3) buildUnderground3();
          else if (S.level >= 2) buildUnderground2();
          else buildUnderground();
          S.underground = true;
          S.player.x = 6 * T;
          S.player.y = 13 * T - S.player.h;
          S.cam.x = 0;
          S.leekProjectiles = [];
        } else {
          S.tiles = S.mainWorldSave.tiles;
          S.enemies = S.mainWorldSave.enemies;
          S.items = S.mainWorldSave.items;
          S.flagpole = S.mainWorldSave.flagpole;
          S.underground = false;
          S.mainWorldSave = null;
          S.player.x = S.pipeReturnX;
          S.player.y = 13 * T - S.player.h;
          S.cam.x = Math.max(0, S.pipeReturnX - W / 3);
          S.leekProjectiles = [];
        }
      }
    } else if (anim.phase === 'black') {
      if (anim.timer >= 25) {
        anim.phase = 'fading';
        anim.timer = 0;
      }
    } else if (anim.phase === 'fading') {
      if (anim.timer >= 30) {
        S.pipeAnim = null;
        S.state = 'playing';
      }
    }
  }

  else if (S.state === 'title' || S.state === 'gameover') {
    S.tick++;
  }
}

// =========================
//       Game Loop
// =========================

function gameLoop() {
  try {
  // State transitions
  if (S.state === 'title') {
    if (wasPressed('Space')) {
      initAudio();
      S.level = 1;
      loadHub();
      startMusic(1);
    }
  }

  if (S.state === 'gameover') {
    if (wasPressed('Enter') || wasPressed('Space')) {
      S.level = 1;
      loadHub();
      startMusic(1);
    }
  }

  if (S.state === 'win') {
    if (S.level < 3 && S.winTimer > 130) {
      if (wasPressed('ArrowLeft') || wasPressed('ArrowUp')) S.winChoice = 'hub';
      if (wasPressed('ArrowRight') || wasPressed('ArrowDown')) S.winChoice = 'next';
    }

    if (S.winTimer > 130 && (wasPressed('Enter') || wasPressed('Space'))) {
      if (S.level < 3 && S.winChoice === 'next') {
        const carry = getPlayerPowerState();
        const nextLevelId = `level${S.level + 1}`;
        loadLevel(nextLevelId, true, carry);
        startMusic(S.level);
      } else {
        const returnSpawn = S.hubReturnSpawn || S.hubSpawnDefault;
        loadHub(returnSpawn);
        startMusic(1);
      }
    }
  }

  update();
  render();

  clearJustPressed();
  } catch(e) {
    console.error('GAME LOOP ERROR:', e);
    // Render error on canvas for debugging
    const c = S.ctx || (S.canvas && S.canvas.getContext('2d'));
    if (c) {
      c.fillStyle = 'red';
      c.font = '14px monospace';
      c.fillText('ERR: ' + e.message, 10, 60);
      c.fillText(String(e.stack).split('\n')[1] || '', 10, 80);
    }
  }
  requestAnimationFrame(gameLoop);
}

export function resetToTitle() {
  stopMusic();
  S.state = 'title';
  S.tick = 0;
  // Reset basic status
  S.score = 0;
  S.coinCount = 0;
  S.lives = 3;
}

export function startGameDirectly() {
  initAudio();
  S.level = 1;
  loadHub();
  startMusic(1);
}

// =========================
//     Initialization
// =========================

let isLoopRunning = false;

export async function initLegacyGame(canvasElement) {
  if (!canvasElement) return;
  S.canvas = canvasElement;
  S.ctx = S.canvas.getContext('2d');
  S.canvas.width = W;
  S.canvas.height = H;
  S.ctx.imageSmoothingEnabled = false;
  S.canvas.focus();
  if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    /** @type {any} */ (window).__S = S;
  }

  await preloadSprites();
  resetGame();
  S.state = 'title';
  
  if (!isLoopRunning) {
    isLoopRunning = true;
    requestAnimationFrame(gameLoop);
  }
}

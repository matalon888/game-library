// Fase 1 — Cinturão de Asteroides. Dono: level-designer.
// Formato canônico de wave (bíblia §8.1): { id, enemy, pattern, count, spawnX, startY, spawnDelay, delayAfter }
// Tempo é relativo (spawnDelay entre cada inimigo da wave; delayAfter antes da próxima wave).
import { BAL } from '../../config/balance.js';

export const LEVEL_01 = {
  id: 'level-01',
  phase: 1,
  theme: 'asteroid-belt',
  bgKey: 'bg_asteroids',          // handoff: pixel-artist
  musicKey: 'stage',              // handoff: composer
  introKey: 'stage1',             // chave em story.js (narrative-designer)
  waves: [
    // INTRO — calmo, ensina a desviar
    { id: 'w1', enemy: 'grunt', pattern: 'straightDown',
      count: 5, spawnX: 'spread', startY: -20,
      spawnDelay: BAL.spawn.gapShort, delayAfter: BAL.spawn.restMedium },

    // senoidais cruzando
    { id: 'w2', enemy: 'weaver', pattern: 'sine',
      count: 6, spawnX: [60, 300], startY: -20,
      spawnDelay: BAL.spawn.gapShort, delayAfter: BAL.spawn.restShort },

    // atiradores fixos + grunts (ensina a priorizar)
    { id: 'w3', enemy: 'turret', pattern: 'turret',
      count: 2, spawnX: 'edges', startY: -20,
      spawnDelay: BAL.spawn.gapMedium, delayAfter: BAL.spawn.restShort },
    { id: 'w3b', enemy: 'grunt', pattern: 'straightDown',
      count: 6, spawnX: 'spread', startY: -20,
      spawnDelay: BAL.spawn.gapTight, delayAfter: BAL.spawn.restMedium },

    // MINI-EVENTO (~pico controlado): mergulhadores
    { id: 'event1', type: 'mini-event', label: 'dive-rush',
      enemy: 'diver', pattern: 'dive', count: 8,
      spawnX: 'edges', startY: -20,
      spawnDelay: BAL.spawn.gapTight, delayAfter: BAL.spawn.restLong },

    // VALE — respiro + janela de power-up
    { id: 'pw', type: 'powerup-window', powerup: 'power',
      delayAfter: BAL.spawn.restMedium },

    // pré-boss: caçadores
    { id: 'w4', enemy: 'hunter', pattern: 'hunter',
      count: 4, spawnX: 'spread', startY: -20,
      spawnDelay: BAL.spawn.gapShort, delayAfter: BAL.spawn.restLong },

    // BOSS
    { id: 'boss', type: 'boss', boss: 'asteroidGuardian' },
  ],
};

export default LEVEL_01;

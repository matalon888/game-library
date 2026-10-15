import { describe, it, expect } from 'vitest';
import { resolveSpawnX, validateLevel, scaleByDifficulty } from '../src/utils/spawn.js';
import LEVEL_01 from '../src/data/levels/level-01.js';
import { ENEMIES } from '../src/data/enemies.js';
import { BOSSES } from '../src/data/bosses.js';
import { PATTERNS } from '../src/systems/MovementPatterns.js';
import { BAL } from '../src/config/balance.js';

describe('spawn e fase', () => {
  it('resolveSpawnX trata número, array e palavras-chave', () => {
    expect(resolveSpawnX(120, 360)).toBe(120);
    expect(resolveSpawnX([10, 20], 360, 1)).toBe(20);
    expect(resolveSpawnX('center', 360)).toBe(180);
    const spread = resolveSpawnX('spread', 360, 0, 5);
    expect(spread).toBeGreaterThanOrEqual(0);
    expect(spread).toBeLessThanOrEqual(360);
  });

  it('LEVEL_01 é válido no formato canônico', () => {
    expect(validateLevel(LEVEL_01)).toEqual([]);
  });

  it('todo enemy/pattern/boss da fase existe nos catálogos', () => {
    for (const w of LEVEL_01.waves) {
      if (w.enemy) {
        expect(ENEMIES[w.enemy], `inimigo ${w.enemy}`).toBeTruthy();
        const p = w.pattern || ENEMIES[w.enemy].pattern;
        expect(PATTERNS[p], `pattern ${p}`).toBeTruthy();
      }
      if (w.type === 'boss') expect(BOSSES[w.boss], `boss ${w.boss}`).toBeTruthy();
    }
  });

  it('scaleByDifficulty usa o multiplicador da fase', () => {
    expect(scaleByDifficulty(10, BAL.difficultyScale, 1)).toBe(10);
    expect(scaleByDifficulty(10, BAL.difficultyScale, 5)).toBe(20);
  });
});

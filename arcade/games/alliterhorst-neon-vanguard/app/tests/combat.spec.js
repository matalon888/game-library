import { describe, it, expect } from 'vitest';
import { applyDamage, isDead, powerUpLevel, powerDownLevel, canTakeDamage, scoreFor, shotsForLevel } from '../src/utils/combat.js';
import { BAL } from '../src/config/balance.js';

describe('combat puro', () => {
  it('applyDamage nunca fica negativo', () => {
    expect(applyDamage(3, 1)).toBe(2);
    expect(applyDamage(1, 5)).toBe(0);
  });
  it('isDead detecta morte', () => {
    expect(isDead(0)).toBe(true);
    expect(isDead(1)).toBe(false);
  });
  it('powerUpLevel respeita o teto', () => {
    expect(powerUpLevel(1, 5)).toBe(2);
    expect(powerUpLevel(5, 5)).toBe(5);
  });
  it('powerDownLevel cai 1 e nunca abaixo de 1', () => {
    expect(powerDownLevel(3)).toBe(2);
    expect(powerDownLevel(1)).toBe(1);
  });
  it('canTakeDamage respeita escudo e i-frames', () => {
    expect(canTakeDamage(1000, 500, false)).toBe(true);
    expect(canTakeDamage(1000, 1500, false)).toBe(false);
    expect(canTakeDamage(1000, 0, true)).toBe(false);
  });
  it('scoreFor aplica combo', () => {
    expect(scoreFor(100, 2)).toBe(200);
  });
  it('shotsForLevel devolve o nº certo de tiros e cai no nível 1 por padrão', () => {
    expect(shotsForLevel(BAL.weapon.levels, 1).length).toBe(1);
    expect(shotsForLevel(BAL.weapon.levels, 3).length).toBe(3);
    expect(shotsForLevel(BAL.weapon.levels, 99).length).toBe(1);
  });
});

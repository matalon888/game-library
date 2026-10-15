import { describe, it, expect } from 'vitest';
import { straightDown, sine, dive, hunter, getPattern } from '../src/systems/MovementPatterns.js';

describe('padrões de movimento (puros)', () => {
  it('straightDown só desce', () => {
    const v = straightDown(0, { speed: 100 });
    expect(v.vx).toBe(0);
    expect(v.vy).toBe(100);
  });
  it('sine oscila no X e desce', () => {
    const v0 = sine(0, { speed: 90, amp: 100, freq: 2 });
    expect(v0.vy).toBe(90);
    expect(Math.abs(v0.vx)).toBeLessThanOrEqual(100);
  });
  it('dive acelera com o tempo', () => {
    const a = dive(0, { speed: 60, accel: 200 });
    const b = dive(1, { speed: 60, accel: 200 });
    expect(b.vy).toBeGreaterThan(a.vy);
  });
  it('hunter persegue o player no X mas é limitado pela velocidade', () => {
    const v = hunter(0, { speed: 70 }, { x: 100, playerX: 300, playerY: 600, y: 100 });
    expect(v.vx).toBeGreaterThan(0);        // vai em direção ao player (direita)
    expect(v.vx).toBeLessThanOrEqual(70);   // nunca mais rápido que o limite
  });
  it('getPattern devolve função e cai em straightDown se nome inválido', () => {
    expect(typeof getPattern('sine')).toBe('function');
    expect(getPattern('inexistente')).toBe(straightDown);
  });
});

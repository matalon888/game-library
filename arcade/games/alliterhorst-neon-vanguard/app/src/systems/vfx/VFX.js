// Linguagem de juice do jogo. Dono: vfx-artist.
// API única: VFX.explode / hitFlash / shake / hitstop. Tetos respeitados (bíblia).
import { HEX } from '../../config/palette.js';

export const VFX = {
  /** explosão em partículas; size 'small' | 'big' */
  explode(scene, x, y, color = HEX.orange, size = 'small') {
    const count = size === 'big' ? 26 : 12;
    const speed = size === 'big' ? { min: 60, max: 220 } : { min: 40, max: 140 };
    const emitter = scene.add.particles(x, y, 'particle', {
      lifespan: size === 'big' ? 600 : 380,
      speed,
      scale: { start: size === 'big' ? 2.4 : 1.6, end: 0 },
      quantity: count,
      tint: [color, HEX.yellow, HEX.white],
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.setDepth(40);
    emitter.explode(count);
    scene.time.delayedCall(700, () => emitter.destroy());
  },

  /** flash branco rápido num sprite ao tomar dano */
  hitFlash(scene, target) {
    if (!target || !target.setTintFill) return;
    target.setTintFill(0xffffff);
    scene.time.delayedCall(70, () => target.active && target.clearTint());
  },

  /** screenshake parcimonioso (teto 0.02) */
  shake(scene, intensity = 0.008, durationMs = 120) {
    scene.cameras.main.shake(durationMs, Math.min(intensity, 0.02));
  },

  /** hitstop sutil (teto 120ms) — congela brevemente para dar peso */
  hitstop(scene, ms = 60) {
    const dur = Math.min(ms, 120);
    scene.physics.world.isPaused = true;
    scene.time.delayedCall(dur, () => { scene.physics.world.isPaused = false; });
  },
};

export default VFX;

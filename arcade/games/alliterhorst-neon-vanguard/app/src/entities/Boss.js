import Phaser from 'phaser';
import { BAL } from '../config/balance.js';

/** Boss com fases de ataque por % de HP. Move em vai-e-vem; telegrafa e é justo. */
export default class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, def) {
    super(scene, BAL.world.width / 2, -60, def.sprite);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.t0 = scene.time.now;
    this.nextFire = scene.time.now + 1400;
    this.body.setImmovable(true);
    this.entered = false;
  }

  currentPhase(ratio) {
    return this.def.phases.find((p) => ratio > p.hpAbove) || this.def.phases[this.def.phases.length - 1];
  }

  tick(time) {
    if (!this.active) return;
    // entrada
    if (!this.entered) {
      this.y += 1.4;
      if (this.y >= 110) { this.y = 110; this.entered = true; }
      return;
    }
    // vai-e-vem horizontal
    this.x = BAL.world.width / 2 + Math.sin((time - this.t0) / 1000 * this.def.moveSpeed) * this.def.moveAmp;

    const ratio = this.hp / this.maxHp;
    const phase = this.currentPhase(ratio);
    if (time > this.nextFire) {
      this.scene.bossShoot(this, phase);
      this.nextFire = time + phase.fireRateMs;
    }
  }
}

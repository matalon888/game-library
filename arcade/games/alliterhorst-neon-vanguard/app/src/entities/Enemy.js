import Phaser from 'phaser';

/** Inimigo comum, dirigido por um padrão de movimento (função pura). Reciclado via pool. */
export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy_grunt');
    this.hp = 1;
  }

  configure(def, patternFn, params, x, y, scoreVal, fireRateMs) {
    this.setTexture(def.sprite);
    this.enableBody(true, x, y, true, true);
    this.hp = def.hp;
    this.patternFn = patternFn;
    this.params = params;
    this.fireRateMs = fireRateMs || 0;
    this.spawnT = this.scene.time.now;
    this.nextFire = this.scene.time.now + (this.fireRateMs ? Phaser.Math.Between(500, 1400) : 0);
    this.scoreVal = scoreVal;
    return this;
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (!this.active) return;
    const tSec = (t - this.spawnT) / 1000;
    const ctx = { x: this.x, y: this.y, playerX: this.scene.player.x, playerY: this.scene.player.y };
    const v = this.patternFn(tSec, this.params, ctx);
    this.setVelocity(v.vx, v.vy);
    if (this.fireRateMs > 0 && t > this.nextFire) {
      this.scene.enemyShoot(this);
      this.nextFire = t + this.fireRateMs;
    }
    if (this.y > 670 || this.x < -50 || this.x > 410) {
      this.disableBody(true, true); // saiu da tela: sem score
    }
  }
}

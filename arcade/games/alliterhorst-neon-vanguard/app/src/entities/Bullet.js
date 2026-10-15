import Phaser from 'phaser';

/** Bala genérica (player ou inimigo). Reciclada via pool (grupo). */
export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet_player');
    this.damage = 1;
  }

  fire(x, y, vx, vy, texture, damage) {
    this.setTexture(texture);
    this.enableBody(true, x, y, true, true);
    this.setVelocity(vx, vy);
    this.damage = damage;
    return this;
  }

  deactivate() {
    this.disableBody(true, true);
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (this.y < -24 || this.y > 664 || this.x < -24 || this.x > 384) {
      this.deactivate();
    }
  }
}

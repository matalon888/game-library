import Phaser from 'phaser';

const TEX = {
  power: 'pu_power', rapid: 'pu_rapid', shield: 'pu_shield',
  speed: 'pu_speed', bomb: 'pu_bomb', life: 'pu_life',
};

/** Power-up que desce devagar; tipo definido em 'kind'. */
export default class PowerUp extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'pu_power');
    this.kind = 'power';
  }

  spawn(kind, x, y) {
    this.kind = kind;
    this.setTexture(TEX[kind] || 'pu_power');
    this.enableBody(true, x, y, true, true);
    this.setVelocity(Phaser.Math.Between(-20, 20), 70);
    return this;
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    if (this.y > 670) this.disableBody(true, true);
  }
}

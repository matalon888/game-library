import Phaser from 'phaser';
import { BAL } from '../config/balance.js';

/** Nave do jogador: segue o ponteiro com lerp, guarda o estado de combate. */
export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.body.setCircle(BAL.player.hitRadius, 14 - BAL.player.hitRadius, 14 - BAL.player.hitRadius);

    this.hp = BAL.player.maxHp;
    this.lives = BAL.player.lives;
    this.weaponLevel = 1;
    this.invulnUntil = 0;
    this.shieldUntil = 0;
    this.rapidUntil = 0;
    this.speedUntil = 0;
    this.bombs = BAL.bomb.startCount;
    this.nextFire = 0;
  }

  hasShield(now) { return now < this.shieldUntil; }
  isInvulnerable(now) { return now < this.invulnUntil; }

  fireRate(now) {
    return now < this.rapidUntil ? BAL.rapid.fireRateMs : BAL.player.fireRateMs;
  }

  lerpFactor(now) {
    return BAL.player.speedLerp + (now < this.speedUntil ? BAL.speed.lerpBonus : 0);
  }

  /** segue o ponteiro suavemente + pisca durante i-frames */
  follow(pointer, now) {
    if (pointer && pointer.active) {
      const f = this.lerpFactor(now);
      this.x = Phaser.Math.Linear(this.x, pointer.x, f);
      this.y = Phaser.Math.Linear(this.y, pointer.y, f);
    }
    this.alpha = this.isInvulnerable(now) ? (Math.floor(now / 80) % 2 ? 0.3 : 1) : 1;
  }
}

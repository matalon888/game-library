import Phaser from 'phaser';
import { BAL } from '../config/balance.js';
import { HEX, READ_RULES } from '../config/palette.js';
import { STORY } from '../data/story.js';
import LEVEL_01 from '../data/levels/level-01.js';
import { getEnemy } from '../data/enemies.js';
import { getBoss } from '../data/bosses.js';
import { getPattern } from '../systems/MovementPatterns.js';
import { resolveSpawnX } from '../utils/spawn.js';
import { shotsForLevel, powerUpLevel, powerDownLevel } from '../utils/combat.js';
import VFX from '../systems/vfx/VFX.js';
import audio from '../systems/audio/AudioManager.js';
import music from '../systems/audio/MusicManager.js';
import Player from '../entities/Player.js';
import Bullet from '../entities/Bullet.js';
import Enemy from '../entities/Enemy.js';
import PowerUp from '../entities/PowerUp.js';
import Boss from '../entities/Boss.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.score = 0;
    this.gameEnded = false;
    this.paused = false;
    this.boss = null;
    this.cameras.main.setBackgroundColor(HEX.bgDeep);

    // ---- starfield (parallax simples) ----
    this.stars = [];
    for (let i = 0; i < 50; i++) {
      const s = this.add.image(Phaser.Math.Between(0, 360), Phaser.Math.Between(0, 640), 'star')
        .setAlpha(Phaser.Math.FloatBetween(0.25, 1)).setDepth(0);
      s.speed = Phaser.Math.Between(30, 120);
      this.stars.push(s);
    }

    // ---- pools ----
    this.playerBullets = this.physics.add.group({ classType: Bullet, maxSize: BAL.player.bulletPoolSize, runChildUpdate: true });
    this.enemyBullets = this.physics.add.group({ classType: Bullet, maxSize: BAL.enemyBullet.poolSize, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: 60, runChildUpdate: true });
    this.powerups = this.physics.add.group({ classType: PowerUp, maxSize: 12, runChildUpdate: true });
    [this.playerBullets, this.enemyBullets, this.enemies, this.powerups].forEach((g) => g.setDepth && g.setDepth(20));

    // ---- player ----
    this.player = new Player(this, BAL.world.width / 2, 540);
    this.player.setDepth(30);

    // ---- HUD paralelo ----
    this.scene.launch('HudScene', { gameScene: this });
    this.emitHud();

    // ---- colisões ----
    this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletHitsEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemyBullets, this.onPlayerHitByBullet, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitByEnemy, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.onPickup, null, this);

    // ---- input ----
    this.input.keyboard.on('keydown-M', () => { audio.toggleMute(); music.toggleMute(); });
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-SPACE', () => this.useBomb());
    this.input.keyboard.on('keydown-X', () => this.useBomb());
    this.input.on('pointerdown', (p) => { if (p.rightButtonDown && p.rightButtonDown()) this.useBomb(); });

    // ---- música da fase ----
    music.init().then(() => { if (!this.gameEnded) music.playStage(); });

    // ---- inicia a fase ----
    this.startLevel(LEVEL_01);
  }

  // ===================== loop =====================
  update(time, delta) {
    if (this.gameEnded || this.paused) return;
    const dt = delta / 1000;
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > 640) { s.y = 0; s.x = Phaser.Math.Between(0, 360); }
    }
    this.player.follow(this.input.activePointer, time);
    if (time > this.player.nextFire) this.firePlayer(time);
    if (this.boss && this.boss.active) {
      this.boss.tick(time);
      this.events.emit('hud:boss', { hp: this.boss.hp, max: this.boss.maxHp });
    }
  }

  // ===================== player =====================
  firePlayer(time) {
    const shots = shotsForLevel(BAL.weapon.levels, this.player.weaponLevel);
    for (const shot of shots) {
      this.spawnPlayerBullet(this.player.x + shot.dx, this.player.y - 12, shot.angle);
    }
    audio.play('shoot');
    this.player.nextFire = time + this.player.fireRate(time);
  }

  spawnPlayerBullet(x, y, angleDeg) {
    const b = this.playerBullets.get();
    if (!b) return;
    const rad = Phaser.Math.DegToRad(angleDeg);
    const sp = BAL.player.bulletSpeed;
    b.setDepth(20);
    b.fire(x, y, Math.sin(rad) * sp, -Math.cos(rad) * sp, 'bullet_player', BAL.player.bulletDamage);
  }

  // ===================== inimigos =====================
  enemyShoot(enemy) {
    const ang = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const sp = BAL.enemyBullet.speed;
    this.spawnEnemyBullet(enemy.x, enemy.y, Math.cos(ang) * sp, Math.sin(ang) * sp);
    audio.play('enemyShoot');
  }

  spawnEnemyBullet(x, y, vx, vy) {
    if (this.enemyBullets.countActive(true) >= BAL.caps.maxEnemyBulletsOnScreen) return;
    const b = this.enemyBullets.get();
    if (!b) return;
    b.setDepth(20);
    b.fire(x, y, vx, vy, 'bullet_enemy', BAL.enemyBullet.damage);
  }

  // ===================== boss =====================
  bossShoot(boss, phase) {
    const sp = phase.bulletSpeed;
    if (phase.attack === 'aimedTriple') {
      const base = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      for (const off of [-0.22, 0, 0.22]) {
        this.spawnEnemyBullet(boss.x, boss.y + 30, Math.cos(base + off) * sp, Math.sin(base + off) * sp);
      }
    } else if (phase.attack === 'spreadFan') {
      for (let a = -40; a <= 40; a += 20) {
        const r = Phaser.Math.DegToRad(a + 90);
        this.spawnEnemyBullet(boss.x, boss.y + 30, Math.cos(r) * sp, Math.sin(r) * sp);
      }
    } else { // circleBurst
      for (let i = 0; i < 10; i++) {
        const r = (i / 10) * Math.PI * 2;
        this.spawnEnemyBullet(boss.x, boss.y + 20, Math.cos(r) * sp, Math.sin(r) * sp);
      }
    }
    audio.play('enemyShoot');
  }

  spawnBoss(key) {
    const def = getBoss(key);
    if (!def) return;
    this.boss = new Boss(this, def);
    this.boss.setDepth(30);
    this.physics.add.overlap(this.playerBullets, this.boss, this.onBulletHitsBoss, null, this);
    this.events.emit('hud:warning', def.name);
    this.events.emit('hud:bossShow', { name: def.name, hp: def.hp, max: def.hp });
    audio.play('bossAlert');
    if (music.started) music.playBoss();
  }

  // ===================== colisões =====================
  onBulletHitsEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    bullet.deactivate();
    enemy.hp -= bullet.damage;
    VFX.hitFlash(this, enemy);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  onBulletHitsBoss(bullet, boss) {
    if (!bullet.active || !boss.active || !boss.entered) return;
    bullet.deactivate();
    boss.hp -= bullet.damage;
    VFX.hitFlash(this, boss);
    if (boss.hp <= 0) this.defeatBoss();
  }

  onPlayerHitByBullet(player, bullet) {
    if (!bullet.active) return;
    bullet.deactivate();
    this.damagePlayer();
  }

  onPlayerHitByEnemy(player, enemy) {
    if (!enemy.active) return;
    this.killEnemy(enemy, false);
    this.damagePlayer();
  }

  onPickup(player, pu) {
    if (!pu.active) return;
    const kind = pu.kind;
    pu.disableBody(true, true);
    this.applyPowerUp(kind);
    audio.play('powerup');
  }

  // ===================== morte/dano =====================
  killEnemy(enemy, giveScore = true) {
    VFX.explode(this, enemy.x, enemy.y, enemy.fxColor || HEX.orange, 'small');
    audio.play('explodeSmall');
    if (giveScore) {
      this.score += enemy.scoreVal || 0;
      this.events.emit('hud:score', this.score);
      if (Math.random() < BAL.powerupDropChance) this.dropPowerUp(enemy.x, enemy.y);
    }
    enemy.disableBody(true, true);
  }

  damagePlayer() {
    const now = this.time.now;
    if (this.player.hasShield(now)) {
      this.player.shieldUntil = 0;
      VFX.hitFlash(this, this.player);
      audio.play('shield');
      return;
    }
    if (this.player.isInvulnerable(now)) return;

    this.player.hp -= 1;
    this.player.weaponLevel = powerDownLevel(this.player.weaponLevel);
    this.player.invulnUntil = now + BAL.player.invulnMs;
    VFX.shake(this, 0.012, 150);
    VFX.hitFlash(this, this.player);
    audio.play('playerHit');
    this.events.emit('hud:hp', this.player.hp);
    this.events.emit('hud:power', this.player.weaponLevel);

    if (this.player.hp <= 0) this.loseLife();
  }

  loseLife() {
    if (this.player.lives > 0) {
      this.player.lives -= 1;
      this.player.hp = BAL.player.maxHp;
      this.player.invulnUntil = this.time.now + 1500;
      this.events.emit('hud:lives', this.player.lives);
      this.events.emit('hud:hp', this.player.hp);
    } else {
      this.endGame(false);
    }
  }

  applyPowerUp(kind) {
    const now = this.time.now;
    switch (kind) {
      case 'power': this.player.weaponLevel = powerUpLevel(this.player.weaponLevel, BAL.player.maxPowerLevel); this.events.emit('hud:power', this.player.weaponLevel); break;
      case 'rapid': this.player.rapidUntil = now + BAL.rapid.durationMs; break;
      case 'speed': this.player.speedUntil = now + BAL.speed.durationMs; break;
      case 'shield': this.player.shieldUntil = now + BAL.shield.durationMs; break;
      case 'bomb': this.player.bombs += 1; this.events.emit('hud:bomb', this.player.bombs); break;
      case 'life': this.player.lives += 1; this.events.emit('hud:lives', this.player.lives); break;
      default: break;
    }
  }

  useBomb() {
    if (this.gameEnded || this.paused || this.player.bombs <= 0) return;
    this.player.bombs -= 1;
    this.events.emit('hud:bomb', this.player.bombs);
    this.enemyBullets.children.each((b) => { if (b.active) b.deactivate(); });
    this.enemies.children.each((e) => { if (e.active) { e.hp -= BAL.bomb.damage; if (e.hp <= 0) this.killEnemy(e); } });
    if (this.boss && this.boss.active && this.boss.entered) { this.boss.hp -= BAL.bomb.damage; if (this.boss.hp <= 0) this.defeatBoss(); }
    VFX.explode(this, this.player.x, this.player.y, HEX.cyan, 'big');
    VFX.shake(this, 0.018, 250);
    audio.play('explodeBig');
  }

  dropPowerUp(x, y) {
    const kinds = ['power', 'rapid', 'shield', 'speed', 'bomb', 'life'];
    const weights = [0.34, 0.18, 0.16, 0.14, 0.12, 0.06];
    let r = Math.random(); let pick = 'power';
    for (let i = 0; i < kinds.length; i++) { if (r < weights[i]) { pick = kinds[i]; break; } r -= weights[i]; }
    this.spawnPowerUp(x, y, pick);
  }

  spawnPowerUp(x, y, kind) {
    const pu = this.powerups.get();
    if (!pu) return;
    pu.setDepth(15);
    pu.spawn(kind, x, y);
  }

  defeatBoss() {
    if (this.gameEnded) return;
    const b = this.boss;
    this.score += BAL.score.boss;
    this.events.emit('hud:score', this.score);
    this.events.emit('hud:bossHide');
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 120, () => VFX.explode(this, b.x + Phaser.Math.Between(-40, 40), b.y + Phaser.Math.Between(-30, 30), HEX.yellow, 'big'));
    }
    audio.play('explodeBig');
    VFX.shake(this, 0.02, 500);
    b.disableBody(true, true);
    this.boss = null;
    music.stop();
    this.time.delayedCall(1600, () => this.endGame(true));
  }

  // ===================== fluxo de fase =====================
  startLevel(level) {
    this.level = level;
    this.waveIndex = 0;
    this.events.emit('hud:message', STORY.stages[level.introKey].intro);
    this.time.delayedCall(1600, () => { this.events.emit('hud:message', ''); this.processWave(); });
  }

  processWave() {
    if (this.gameEnded) return;
    const w = this.level.waves[this.waveIndex];
    if (!w) return;
    if (w.type === 'boss') { this.spawnBoss(w.boss); return; }
    if (w.type === 'powerup-window') {
      this.spawnPowerUp(BAL.world.width / 2, -10, w.powerup);
      this.time.delayedCall(w.delayAfter || 1200, () => this.advanceWave());
      return;
    }
    // wave normal ou mini-evento: spawna 'count' inimigos espaçados
    let i = 0;
    const spawnOne = () => {
      if (this.gameEnded) return;
      this.spawnEnemy(w, i);
      i += 1;
      if (i < w.count) this.time.delayedCall(w.spawnDelay, spawnOne);
      else this.time.delayedCall(w.delayAfter || 1200, () => this.advanceWave());
    };
    spawnOne();
  }

  advanceWave() {
    this.waveIndex += 1;
    this.processWave();
  }

  spawnEnemy(wave, index) {
    if (this.enemies.countActive(true) >= BAL.caps.maxEnemiesOnScreen) return;
    const def = getEnemy(wave.enemy);
    if (!def) return;
    const pattern = getPattern(wave.pattern || def.pattern);
    const x = resolveSpawnX(wave.spawnX, BAL.world.width, index, wave.count);
    const y = wave.startY != null ? wave.startY : -20;
    const e = this.enemies.get();
    if (!e) return;
    e.setDepth(20);
    e.configure(def, pattern, def.patternParams, x, y, BAL.score[def.scoreKey] || 100, def.fireRateMs);
    e.fxColor = HEX[def.color] || HEX.orange;
  }

  // ===================== util =====================
  togglePause() {
    this.paused = !this.paused;
    this.physics.world.isPaused = this.paused;
    this.events.emit('hud:message', this.paused ? STORY.ui.pause : '');
  }

  emitHud() {
    this.events.emit('hud:hp', this.player.hp);
    this.events.emit('hud:lives', this.player.lives);
    this.events.emit('hud:score', this.score);
    this.events.emit('hud:power', this.player.weaponLevel);
    this.events.emit('hud:bomb', this.player.bombs);
  }

  endGame(victory) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    music.stop();
    if (!victory) audio.play('gameOver');
    this.scene.stop('HudScene');
    this.scene.start('GameOverScene', { victory, score: this.score });
  }
}

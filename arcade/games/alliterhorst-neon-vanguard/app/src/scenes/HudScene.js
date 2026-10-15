import Phaser from 'phaser';
import { PALETTE, HEX } from '../config/palette.js';

/** HUD em cena paralela. Comunicação só por eventos hud:* vindos da GameScene. */
export default class HudScene extends Phaser.Scene {
  constructor() { super('HudScene'); }

  init(data) { this.gs = data.gameScene; }

  create() {
    const f = (size, color) => ({ fontFamily: 'monospace', fontSize: `${size}px`, color });

    this.scoreText = this.add.text(180, 8, '0', f(14, PALETTE.white)).setOrigin(0.5, 0);
    this.livesText = this.add.text(352, 10, 'x2', f(11, PALETTE.cyan)).setOrigin(1, 0);
    this.powerText = this.add.text(8, 28, 'PWR 1', f(10, PALETTE.cyan)).setOrigin(0, 0);
    this.bombText = this.add.text(8, 620, 'BOMB 1', f(10, PALETTE.orange)).setOrigin(0, 1);

    // pips de vida
    this.hpGfx = this.add.graphics();
    this.hp = 3;

    // barra de boss (oculta)
    this.bossBar = this.add.graphics().setVisible(false);
    this.bossName = this.add.text(180, 36, '', f(9, PALETTE.magenta)).setOrigin(0.5, 0).setVisible(false);
    this.bossHp = 1; this.bossMax = 1;

    // mensagem central (intro de fase, pausa)
    this.msg = this.add.text(180, 300, '', f(13, PALETTE.white)).setOrigin(0.5);

    this.drawHp();
    this.bindEvents();

    this.events.on('shutdown', () => this.unbind());
  }

  bindEvents() {
    const e = this.gs.events;
    this._h = {
      hp: (v) => { this.hp = v; this.drawHp(); },
      lives: (v) => this.livesText.setText('x' + v),
      score: (v) => this.scoreText.setText(String(v).padStart(6, '0')),
      power: (v) => this.powerText.setText('PWR ' + v),
      bomb: (v) => this.bombText.setText('BOMB ' + v),
      message: (t) => this.msg.setText(t || ''),
      warning: (name) => this.flashWarning(name),
      bossShow: (d) => this.showBoss(d),
      boss: (d) => { this.bossHp = d.hp; this.bossMax = d.max; this.drawBoss(); },
      bossHide: () => this.hideBoss(),
    };
    e.on('hud:hp', this._h.hp);
    e.on('hud:lives', this._h.lives);
    e.on('hud:score', this._h.score);
    e.on('hud:power', this._h.power);
    e.on('hud:bomb', this._h.bomb);
    e.on('hud:message', this._h.message);
    e.on('hud:warning', this._h.warning);
    e.on('hud:bossShow', this._h.bossShow);
    e.on('hud:boss', this._h.boss);
    e.on('hud:bossHide', this._h.bossHide);
  }

  unbind() {
    if (!this.gs || !this.gs.events) return;
    const e = this.gs.events;
    Object.entries({
      'hud:hp': this._h.hp, 'hud:lives': this._h.lives, 'hud:score': this._h.score,
      'hud:power': this._h.power, 'hud:bomb': this._h.bomb, 'hud:message': this._h.message,
      'hud:warning': this._h.warning, 'hud:bossShow': this._h.bossShow,
      'hud:boss': this._h.boss, 'hud:bossHide': this._h.bossHide,
    }).forEach(([k, fn]) => e.off(k, fn));
  }

  drawHp() {
    this.hpGfx.clear();
    for (let i = 0; i < this.hp; i++) {
      this.hpGfx.fillStyle(HEX.green, 1);
      this.hpGfx.fillRect(8 + i * 14, 10, 10, 10);
    }
  }

  showBoss(d) {
    this.bossHp = d.hp; this.bossMax = d.max;
    this.bossName.setText(d.name).setVisible(true);
    this.bossBar.setVisible(true);
    this.drawBoss();
  }

  drawBoss() {
    this.bossBar.clear();
    this.bossBar.fillStyle(HEX.bgMid, 1).fillRect(30, 50, 300, 8);
    const w = Math.max(0, Math.min(1, this.bossHp / this.bossMax)) * 300;
    this.bossBar.fillStyle(HEX.magenta, 1).fillRect(30, 50, w, 8);
  }

  hideBoss() {
    this.bossBar.setVisible(false);
    this.bossName.setVisible(false);
  }

  flashWarning(name) {
    const w = this.add.text(180, 250, 'WARNING', { fontFamily: 'monospace', fontSize: '24px', color: PALETTE.red, fontStyle: 'bold' }).setOrigin(0.5);
    this.tweens.add({ targets: w, alpha: 0, duration: 350, yoyo: true, repeat: 2, onComplete: () => w.destroy() });
  }
}

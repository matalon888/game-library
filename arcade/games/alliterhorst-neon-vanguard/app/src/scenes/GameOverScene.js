import Phaser from 'phaser';
import { PALETTE, HEX } from '../config/palette.js';
import { STORY } from '../data/story.js';
import audio from '../systems/audio/AudioManager.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data) { this.victory = !!data.victory; this.finalScore = data.score || 0; }

  create() {
    const cx = 180;
    this.cameras.main.setBackgroundColor(HEX.bgDeep);

    // recorde via localStorage (persistência simples)
    let best = 0;
    try { best = parseInt(localStorage.getItem('nv_best') || '0', 10) || 0; } catch (_) {}
    if (this.finalScore > best) { best = this.finalScore; try { localStorage.setItem('nv_best', String(best)); } catch (_) {} }

    const title = this.victory ? STORY.ui.victory : STORY.ui.gameOver;
    const color = this.victory ? PALETTE.green : PALETTE.red;
    this.add.text(cx, 230, title, { fontFamily: 'monospace', fontSize: '28px', color, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 290, 'PONTOS  ' + String(this.finalScore).padStart(6, '0'), { fontFamily: 'monospace', fontSize: '13px', color: PALETTE.white }).setOrigin(0.5);
    this.add.text(cx, 314, 'RECORDE ' + String(best).padStart(6, '0'), { fontFamily: 'monospace', fontSize: '11px', color: PALETTE.gray }).setOrigin(0.5);

    const prompt = this.add.text(cx, 410, STORY.ui.retry, { fontFamily: 'monospace', fontSize: '11px', color: PALETTE.cyan }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => {
      audio.play('uiClick');
      this.scene.start('GameScene');
    });
  }
}

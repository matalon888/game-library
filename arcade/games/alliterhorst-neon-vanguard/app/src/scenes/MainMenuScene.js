import Phaser from 'phaser';
import { PALETTE, HEX } from '../config/palette.js';
import { STORY } from '../data/story.js';
import audio from '../systems/audio/AudioManager.js';
import music from '../systems/audio/MusicManager.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create() {
    const cx = 180;
    this.cameras.main.setBackgroundColor(HEX.bgDeep);

    // estrelas decorativas
    this.stars = [];
    for (let i = 0; i < 40; i++) {
      const s = this.add.image(Phaser.Math.Between(0, 360), Phaser.Math.Between(0, 640), 'star')
        .setAlpha(Phaser.Math.FloatBetween(0.3, 1));
      s.speed = Phaser.Math.Between(20, 80);
      this.stars.push(s);
    }

    this.add.text(cx, 200, 'NEON', { fontFamily: 'monospace', fontSize: '52px', color: PALETTE.cyan, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 256, 'VANGUARD', { fontFamily: 'monospace', fontSize: '36px', color: PALETTE.magenta, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 300, STORY.stages.stage1.name, { fontFamily: 'monospace', fontSize: '11px', color: PALETTE.gray }).setOrigin(0.5);

    const prompt = this.add.text(cx, 420, STORY.ui.start, { fontFamily: 'monospace', fontSize: '12px', color: PALETTE.white }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    this.add.text(cx, 470, STORY.ui.hint, { fontFamily: 'monospace', fontSize: '9px', color: PALETTE.gray }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      audio.init();
      audio.play('uiClick');
      music.init();
      this.scene.start('GameScene');
    });
  }

  update(time, delta) {
    const dt = delta / 1000;
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > 640) { s.y = 0; s.x = Phaser.Math.Between(0, 360); }
    }
  }
}

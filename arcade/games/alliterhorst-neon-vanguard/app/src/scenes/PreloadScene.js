import Phaser from 'phaser';
import { createTextures } from '../gfx/TextureFactory.js';
import { PALETTE } from '../config/palette.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }
  create() {
    // gera todas as texturas por código (offline, sem assets externos)
    createTextures(this);
    this.add.text(180, 320, 'CARREGANDO...', {
      fontFamily: 'monospace', fontSize: '14px', color: PALETTE.cyan,
    }).setOrigin(0.5);
    this.time.delayedCall(120, () => this.scene.start('MainMenuScene'));
  }
}

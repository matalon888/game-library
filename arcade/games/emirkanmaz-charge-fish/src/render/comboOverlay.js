// Combo display — visible only while a streak is active. Shows multiplier
// and a decay bar showing how long until the streak expires.

import * as Combo from '../combo.js';
import * as Game from '../game.js';
import { t } from '../i18n.js';

export const comboOverlay = {
  update() { Combo.tick(); },

  draw({ ctx, width, height, time, game }) {
    const streak = Combo.getStreak();
    if (streak < 2) return;
    const mult = Combo.getMultiplier();
    const decay = Combo.getDecayProgress();

    // Above the bottom hint, anchored center-bottom
    const cx = width / 2;
    const cy = height * 0.78;

    const pulse = 1 + 0.04 * Math.sin(time * 0.012);

    // Multiplier text
    ctx.font = `800 ${Math.round(28 * pulse)}px -apple-system, sans-serif`;
    ctx.fillStyle = mult >= 3 ? '#ff9a4f' : '#f4b860';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(`×${mult}  ·  ${streak}`, cx, cy);
    ctx.shadowBlur = 0;

    // Decay bar
    const barW = 120;
    const barH = 3;
    const barX = cx - barW / 2;
    const barY = cy + 22;
    ctx.fillStyle = 'rgba(232, 244, 255, 0.2)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = mult >= 3 ? '#ff9a4f' : '#f4b860';
    ctx.fillRect(barX, barY, barW * (1 - decay), barH);
  },
};

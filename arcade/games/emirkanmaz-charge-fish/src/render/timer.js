// Survival timer overlay — top-center. Pulses red when time is critical.

import { isSurvival, getStatus, formatTime, TUNING } from '../modes/mode.js';
import { t } from '../i18n.js';

const CRITICAL_MS = 5000;

export const timerOverlay = {
  draw({ ctx, width, height, time }) {
    if (!isSurvival()) return;
    const st = getStatus();
    if (!st) return;

    const remaining = Math.max(0, st.timeRemainingMs);
    const totalForBar = TUNING.SURVIVAL_INITIAL_MS;
    const fillRatio = Math.min(1, remaining / totalForBar);
    const isCritical = remaining < CRITICAL_MS;
    const pulse = isCritical ? 0.55 + 0.45 * Math.abs(Math.sin(time * 0.012)) : 1;

    // Center horizontally, anchored a bit below the top
    const centerX = width / 2;
    const baseY = 26;

    // Small label above
    ctx.font = '500 11px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(232, 244, 255, 0.65)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(t('survivalTimeLeft').toUpperCase(), centerX, baseY);

    // Big time
    ctx.font = `700 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = isCritical
      ? `rgba(255, 110, 90, ${pulse})`
      : '#f4b860';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(formatTime(remaining), centerX, baseY + 14);
    ctx.shadowBlur = 0;

    // Thin remaining-time bar underneath
    const barW = Math.min(220, width * 0.6);
    const barH = 4;
    const barX = centerX - barW / 2;
    const barY = baseY + 60;
    ctx.fillStyle = 'rgba(232, 244, 255, 0.18)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = isCritical
      ? `rgba(255, 110, 90, ${pulse})`
      : '#f4b860';
    ctx.fillRect(barX, barY, barW * fillRatio, barH);
  },
};

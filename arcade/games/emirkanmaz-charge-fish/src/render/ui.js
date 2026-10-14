// Score + state hint + best score overlay.

import { State } from '../game.js';
import { getStats } from '../storage.js';
import { isUsingFallback } from '../sensors/battery.js';
import { isSurvival } from '../modes/mode.js';
import { t } from '../i18n.js';

function hintKeyFor(state, tapMode) {
  switch (state) {
    case State.IDLE: return tapMode ? 'hintIdleTap' : 'hintIdleCharge';
    case State.FISHING: return tapMode ? 'hintFishingTap' : 'hintFishingCharge';
    case State.HOOKED: return tapMode ? 'hintHookedTap' : 'hintHookedCharge';
    default: return null;
  }
}

// The high score is read from storage on score change only — avoids hitting
// localStorage every frame.
let cachedHighscore = 0;
let lastScoreSeen = -1;

function refreshHighscore(currentScore) {
  if (currentScore !== lastScoreSeen) {
    cachedHighscore = Math.max(getStats().highscore, currentScore);
    lastScoreSeen = currentScore;
  }
}

export const ui = {
  draw({ ctx, width, height, time, game }) {
    refreshHighscore(game.score);
    const tapMode = isUsingFallback();
    // Push score downward in survival so it doesn't fight the timer overlay.
    const scoreY = isSurvival() ? 100 : 20;

    // Score — top right
    ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f4b860';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.fillText(`★ ${game.score}`, width - 18, scoreY);
    ctx.shadowBlur = 0;

    // Best score
    if (cachedHighscore > 0) {
      ctx.font = '500 12px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(232, 244, 255, 0.6)';
      ctx.fillText(`${t('bestPrefix')}: ${cachedHighscore}`, width - 18, scoreY + 32);
    }

    // State hint — mid-bottom
    const hintKey = hintKeyFor(game.state, tapMode);
    if (hintKey) {
      const isUrgent = game.state === State.HOOKED;
      const pulse = isUrgent ? 0.7 + 0.3 * Math.sin(time * 0.012) : 1;
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = isUrgent
        ? `rgba(255, 180, 100, ${pulse})`
        : 'rgba(232, 244, 255, 0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(t(hintKey), width / 2, height * 0.88);
      ctx.shadowBlur = 0;
    }
  },
};

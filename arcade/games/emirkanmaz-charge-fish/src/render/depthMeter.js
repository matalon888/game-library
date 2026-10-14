// Depth indicator. In IDLE the bar oscillates up and down; when entering any
// non-IDLE state the value at that moment (minus a small lock delay that
// compensates for the OS chargingchange propagation lag) is frozen and used
// as the cast depth multiplier.

import { DEPTH_METER } from '../config.js';
import { State } from '../game.js';
import { t } from '../i18n.js';

let liveDepth = 0.5;       // 0..1, animated in IDLE
let frozenDepth = 0.7;     // value locked at CASTING start
let isFrozen = false;

// Deterministic triangle wave — same value for any given time. Lets us
// look back in time without keeping a buffer.
function depthAtTime(time) {
  const phase = (time * DEPTH_METER.ANIM_SPEED) / Math.PI;
  const fracIn = phase - Math.floor(phase);
  return fracIn < 0.5 ? fracIn * 2 : 2 - fracIn * 2;
}

export const depthMeter = {
  update({ time, game }) {
    if (game.state === State.IDLE) {
      liveDepth = depthAtTime(time);
      isFrozen = false;
    } else if (!isFrozen) {
      // Charge detection lag compensation: lock the value as it was
      // LOCK_DELAY_MS ago (what the user saw when they plugged in).
      frozenDepth = depthAtTime(time - DEPTH_METER.LOCK_DELAY_MS);
      isFrozen = true;
    }
  },

  draw({ ctx, width, height, game }) {
    const topY = height * DEPTH_METER.TOP_Y_RATIO;
    const bottomY = height * DEPTH_METER.BOTTOM_Y_RATIO;
    const barX = width - DEPTH_METER.RIGHT_MARGIN_PX;
    const barW = DEPTH_METER.BAR_WIDTH_PX;
    const barH = bottomY - topY;

    // Track
    ctx.fillStyle = 'rgba(232, 244, 255, 0.18)';
    roundedRect(ctx, barX - barW / 2, topY, barW, barH, barW / 2);
    ctx.fill();

    // Locked depth marker (visible whenever frozen)
    const lockedY = topY + barH * frozenDepth;
    if (isFrozen) {
      ctx.fillStyle = 'rgba(244, 184, 96, 0.4)';
      ctx.fillRect(barX - barW / 2 - 3, lockedY - 1, barW + 6, 2);
    }

    // Live indicator: bright while moving in IDLE, dimmed once frozen
    const indicatorValue = isFrozen ? frozenDepth : liveDepth;
    const indicatorY = topY + barH * indicatorValue;
    const indicatorH = DEPTH_METER.INDICATOR_HEIGHT_PX;
    const isLive = game.state === State.IDLE;

    ctx.fillStyle = isLive ? '#f4b860' : 'rgba(244, 184, 96, 0.7)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = isLive ? 6 : 0;
    roundedRect(
      ctx,
      barX - (barW / 2 + 6),
      indicatorY - indicatorH / 2,
      barW + 12,
      indicatorH,
      4,
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Labels (localized)
    ctx.fillStyle = 'rgba(232, 244, 255, 0.55)';
    ctx.font = '600 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('depthShallow'), barX, topY - 6);
    ctx.textBaseline = 'top';
    ctx.fillText(t('depthDeep'), barX, bottomY + 6);
  },

  getDepth() {
    return isFrozen ? frozenDepth : liveDepth;
  },
};

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

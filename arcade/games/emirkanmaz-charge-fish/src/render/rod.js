// Rod, line and hook. State drives lineDepth and hook position; both are
// exposed publicly (hookX, hookY) for the catch system to consume.

import { ROD, TIMING } from '../config.js';
import { State } from '../game.js';
import { depthMeter } from './depthMeter.js';
import * as Upgrades from '../upgrades.js';

function effectiveReelMs() {
  // Reel upgrade shortens the animation; capped so it never goes absurdly fast.
  const reduction = Math.min(0.6, Upgrades.getEffect('reel'));
  return TIMING.REEL_ANIMATION_MS * (1 - reduction);
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;

function lineDepthFor(state, elapsedMs) {
  switch (state) {
    case State.IDLE:
      return 0;
    case State.CASTING: {
      const t = Math.min(elapsedMs / TIMING.CAST_ANIMATION_MS, 1);
      return easeOutCubic(t);
    }
    case State.FISHING:
    case State.HOOKED:
      return 1;
    case State.REELING: {
      const t = Math.min(elapsedMs / effectiveReelMs(), 1);
      return 1 - easeInCubic(t);
    }
    default:
      return 0;
  }
}

export const rod = {
  hookX: 0,
  hookY: 0,
  lineDepth: 0,
  _lastHookX: null,

  update({ width, height, time, game, gamma }) {
    const anchorX = width * 0.5;
    const anchorY = height * ROD.ANCHOR_Y_RATIO;
    // Map the depth meter's 0..1 value to the MIN..MAX hook depth range.
    const depthRatio =
      ROD.MIN_HOOK_DEPTH_RATIO +
      (ROD.MAX_HOOK_DEPTH_RATIO - ROD.MIN_HOOK_DEPTH_RATIO) * depthMeter.getDepth();
    const maxHookY = height * depthRatio;
    const elapsedMs = time - game.stateEnteredAt;
    const depth = lineDepthFor(game.state, elapsedMs);
    const horizontalRange = width * 0.42;
    const gammaHookX = anchorX + gamma * horizontalRange;

    let hookX;
    if (game.state === State.CASTING) {
      const t = Math.min(elapsedMs / TIMING.CAST_ANIMATION_MS, 1);
      hookX = anchorX + (gammaHookX - anchorX) * easeOutCubic(t);
      this._lastHookX = hookX;
    } else if (game.state === State.FISHING || game.state === State.HOOKED) {
      hookX = gammaHookX;
      this._lastHookX = hookX;
    } else if (game.state === State.REELING) {
      hookX = this._lastHookX ?? anchorX;
    } else {
      hookX = anchorX;
      this._lastHookX = null;
    }

    this.hookX = hookX;
    this.hookY = anchorY + (maxHookY - anchorY) * depth;
    this.lineDepth = depth;
    this._anchorX = anchorX;
    this._anchorY = anchorY;
    this._time = time;
    this._isHooked = game.state === State.HOOKED;
  },

  draw({ ctx }) {
    const anchorX = this._anchorX;
    const anchorY = this._anchorY;
    const hookX = this.hookX;
    const hookY = this.hookY;
    const depth = this.lineDepth;

    // Rod shaft
    ctx.strokeStyle = '#7a4a1f';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(anchorX - 70, anchorY - 38);
    ctx.lineTo(anchorX, anchorY);
    ctx.stroke();

    // Grip
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(anchorX - 92, anchorY - 50);
    ctx.lineTo(anchorX - 72, anchorY - 39);
    ctx.stroke();

    if (depth > 0.02) {
      // While HOOKED add some noise to the mid of the line curve so it
      // visibly shakes — feedback that something is on the hook.
      let shakeX = 0;
      let shakeY = 0;
      if (this._isHooked) {
        const t = this._time * 0.04;
        shakeX = Math.sin(t * 1.7) * 6 + Math.sin(t * 3.3) * 3;
        shakeY = Math.cos(t * 2.1) * 3;
      }

      ctx.strokeStyle = ROD.LINE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      const midX = (anchorX + hookX) / 2 + (hookX - anchorX) * 0.05 + shakeX;
      const midY = (anchorY + hookY) / 2 + shakeY;
      ctx.quadraticCurveTo(midX, midY, hookX, hookY);
      ctx.stroke();

      drawHook(ctx, hookX, hookY);
    }
  },

  getHookPosition() {
    // Used for collision-check gating only. Follow logic in catch.js reads
    // hookX/hookY directly so it isn't filtered out during late REELING.
    return this.lineDepth > 0.85 ? { x: this.hookX, y: this.hookY } : null;
  },
};

function drawHook(ctx, x, y) {
  const s = ROD.HOOK_SIZE_PX;
  ctx.strokeStyle = '#d8d8d8';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - s * 0.4, y, s * 0.4, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.8, y);
  ctx.lineTo(x - s * 0.8, y - s * 0.25);
  ctx.stroke();
}

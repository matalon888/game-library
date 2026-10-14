// A single fish. Entity contract: update(frame) + draw(ctx) + getBoundingBox().

import { SCENE } from '../config.js';
import * as Settings from '../settings.js';

const TAIL_WIGGLE_SPEED = 9;
const VERTICAL_DRIFT_RATE = 0.025;
const VERTICAL_RETARGET_MIN_MS = 2500;
const VERTICAL_RETARGET_MAX_MS = 5500;
const EDGE_MARGIN = 30;

function randomRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export class Fish {
  constructor(type, x, y, direction) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.direction = direction; // 1 = right, -1 = left
    this.speed = randomRange(type.speedRange[0], type.speedRange[1]);
    this.swimPhase = Math.random() * Math.PI * 2;
    this.targetY = y;
    this.retargetTimer = randomRange(VERTICAL_RETARGET_MIN_MS, VERTICAL_RETARGET_MAX_MS);
    // When attached, the catch system drives position; this fish stops
    // running its own swim logic.
    this.attached = false;
  }

  update(frame) {
    const { dtMs, height } = frame;
    const dtSec = dtMs / 1000;

    if (this.attached) {
      // Only the tail keeps wiggling (panic). Position is set by catchSystem.
      this.swimPhase += dtSec * TAIL_WIGGLE_SPEED * 2.5;
      return;
    }

    this.x += this.speed * this.direction * dtSec;
    this.y += (this.targetY - this.y) * VERTICAL_DRIFT_RATE;
    this.swimPhase += dtSec * TAIL_WIGGLE_SPEED;

    this.retargetTimer -= dtMs;
    if (this.retargetTimer <= 0) {
      const waterY = height * SCENE.WATER_LINE_RATIO;
      const minY = waterY + EDGE_MARGIN;
      const maxY = height - EDGE_MARGIN;
      this.targetY = randomRange(minY, maxY);
      this.retargetTimer = randomRange(VERTICAL_RETARGET_MIN_MS, VERTICAL_RETARGET_MAX_MS);
    }
  }

  isOffscreen(width) {
    const margin = this.type.sizePx;
    return (
      (this.direction > 0 && this.x > width + margin) ||
      (this.direction < 0 && this.x < -margin)
    );
  }

  getBoundingBox() {
    const s = this.type.sizePx;
    return {
      x: this.x - s * 0.5,
      y: this.y - s * 0.3,
      w: s,
      h: s * 0.6,
    };
  }

  draw(ctx) {
    const size = this.type.sizePx;
    const tailWiggle = Math.sin(this.swimPhase) * size * 0.08;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.direction, 1);

    // Tail (triangle, wiggles)
    ctx.fillStyle = this.type.accentColor;
    ctx.beginPath();
    ctx.moveTo(-size * 0.45, 0);
    ctx.lineTo(-size * 0.75, -size * 0.25 + tailWiggle);
    ctx.lineTo(-size * 0.75, size * 0.25 + tailWiggle);
    ctx.closePath();
    ctx.fill();

    // Body (ellipse)
    ctx.fillStyle = this.type.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight stripe — gives golden fish a shimmer
    if (this.type.id === 'golden') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-size * 0.05, -size * 0.12, size * 0.3, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Color-blind patterns: distinct shape per species so colour is not the
    // only signal. Drawn as dark dots/stripes overlay on the body.
    if (Settings.get().colorBlind) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      switch (this.type.id) {
        case 'small': // no pattern (smallest, easy to read as plain)
          break;
        case 'medium': // single horizontal stripe
          ctx.fillRect(-size * 0.4, -size * 0.04, size * 0.7, size * 0.06);
          break;
        case 'big': // three vertical bars
          for (let i = -1; i <= 1; i++) {
            ctx.fillRect(i * size * 0.18 - size * 0.025, -size * 0.18, size * 0.05, size * 0.36);
          }
          break;
        case 'golden': // dot cluster
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * size * 0.18, Math.sin(a) * size * 0.12, size * 0.05, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
      }
    }

    // Fin
    ctx.fillStyle = this.type.accentColor;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.15);
    ctx.lineTo(-size * 0.15, size * 0.35);
    ctx.lineTo(size * 0.05, size * 0.28);
    ctx.closePath();
    ctx.fill();

    // Eye
    const eyeX = size * 0.25;
    const eyeY = -size * 0.06;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(eyeX + size * 0.015, eyeY, size * 0.045, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

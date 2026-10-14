// Single requestAnimationFrame loop. All drawing flows through here.
// Drawable contract: { update?(frame), draw(frame) }
// frame: { ctx, width, height, dtMs, time, game, gamma }

import * as Game from '../game.js';
import { readGamma } from '../sensors/orientation.js';

let running = false;
let lastTimeMs = 0;
const drawables = [];

export function addDrawable(drawable) {
  drawables.push(drawable);
}

export function startRenderer(canvas) {
  if (running) return;
  const ctx = canvas.getContext('2d');
  running = true;
  lastTimeMs = performance.now();

  const tick = (now) => {
    if (!running) return;
    const dtMs = now - lastTimeMs;
    lastTimeMs = now;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const frame = {
      ctx,
      width,
      height,
      dtMs,
      time: now,
      game: Game.getSnapshot(),
      gamma: readGamma(),
    };

    ctx.clearRect(0, 0, width, height);
    for (const d of drawables) {
      if (d.update) d.update(frame);
      d.draw(frame);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function stopRenderer() {
  running = false;
}
